// src/hooks/useSharedUploadLogic.js

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, Dimensions, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 경로는 사용자 프로젝트 구조에 맞게 조정하세요.
import { canvasConfig } from '../config/compositeConfig'; 
import API from '../config/api'; 


const { width: screenWidth } = Dimensions.get('window');

// 캔버스 크기 계산 유틸리티
function getCanvasDims() {
  const baseWidth = Math.floor(screenWidth * 0.7);
  const baseHeight = Math.floor((baseWidth * canvasConfig.height) / canvasConfig.width);
  return { width: baseWidth, height: baseHeight };
}
const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = getCanvasDims();
const cellPaddingX = canvasConfig.table.cellPaddingX;
const cellPaddingY = canvasConfig.table.cellPaddingY;


export const useSharedUploadLogic = (navigation, route, mode = 'each') => {
  const [user, setUser] = useState(null);
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const [datePickerField, setDatePickerField] = useState(null);

  useEffect(() => {
    loadUser();
    fetchForms();
    requestCameraPermission();
    restoreUploadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- 유틸리티 및 초기화 ---

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          // 최신 안드로이드 권한 포함
          Platform.Version >= 33 
            ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
            : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE, 
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        ]);
      } catch (err) {
        console.warn('Permission error:', err);
      }
    }
  };

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
  };

const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const userData = await AsyncStorage.getItem('user');
      const userObj = userData ? JSON.parse(userData) : null;
      // 1. 🚨 [수정] 인증 및 ID 검사 강화
      if (!userObj?.token || !userObj.companyId || !userObj.teamId) {
        Alert.alert('오류', '로그인이 필요하거나 권한 정보가 부족합니다.');
        setLoading(false); 
        return;
      }

      const companyId = userObj.companyId;
console.log('userObj확인:', userObj);
      const teamId = userObj.teamId;
        
      // 2. 🟢 [수정] 동적 API URL 구성: /api/companies/ID/teams/ID/forms
      const url = `${API.companyTeamsBase}/${companyId}/teams/${teamId}/forms`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${userObj.token}`, 'Content-Type': 'application/json' },
      });
        
      // 3. 응답 처리
      const data = await res.json();
      
      if (data.success) {
        setForms((data.forms || []).filter(f => f.isActive !== false).map(f => ({
          ...f,
          fields: Array.isArray(f.fields) ? f.fields : [],


        })));
      } else {
        Alert.alert('오류',url, data.error || '양식 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      console.error('Fetch forms error:', err);
      Alert.alert('오류', '양식 목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  const restoreUploadState = async () => {
    const storedMode = await AsyncStorage.getItem('uploadMode');
    if (storedMode && storedMode !== mode) {
      // 모드 불일치 시 네비게이션 처리 (필요하다면 상위 컴포넌트에서 처리)
      return;
    }
    
    if (route?.params?.restoreForm) {
      const prevForm = await AsyncStorage.getItem('prevUploadForm');
      const prevFormData = await AsyncStorage.getItem('prevUploadFormData');
      if (prevForm) setSelectedForm(JSON.parse(prevForm));
      if (prevFormData) setFormData(JSON.parse(prevFormData));
    }
  };

  // --- 폼/데이터 처리 ---

  const handleSelectForm = useCallback(async (form) => {
    setSelectedForm(form);
    // form 상세 조회 (field option/type 포함)
    try {
      const userData = await AsyncStorage.getItem('user');
      const userObj = userData ? JSON.parse(userData) : null;
      if (!userObj?.token || !userObj.companyId || !userObj.teamId) {
        Alert.alert('오류', '로그인이 필요하거나 권한 정보가 부족합니다.');
        return;
      }
      const companyId = userObj.companyId;
      const teamId = userObj.teamId;
      const formId = form._id || form.id;
      const url = `${API.companyTeamsBase}/${companyId}/teams/${teamId}/forms/${formId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${userObj.token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!data.success || !data.form) {
        Alert.alert('오류', data.error || '양식 상세 정보를 불러올 수 없습니다.');
        return;
      }
      const detailForm = data.form;
      setSelectedForm(detailForm);
      // 필드별 타입/옵션에 따라 초기값 구성
      const initialData = {};
      const now = new Date();
      const kstOffset = 9 * 60;
      const kstTime = now.getTime() + (now.getTimezoneOffset() * 60000) + (kstOffset * 60000);
      const kstDate = new Date(kstTime);
      const year = kstDate.getFullYear();
      const month = String(kstDate.getMonth() + 1).padStart(2, '0');
      const day = String(kstDate.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;
      (Array.isArray(detailForm.fields) ? detailForm.fields : []).forEach(field => {
        // 타입/옵션 추출: field 객체에서 직접
        let key = typeof field === 'object' ? field.name : field;
        let type = 'text';
        let options = [];
        if (typeof field === 'object') {
          type = field.type || 'text';
          options = Array.isArray(field.options) ? field.options : [];
        }
        // options를 initialData에 같이 저장 (for debugging/inspection, not for formData)
        if (type === 'date') {
          initialData[key] = today;
        } else if (type === 'number') {
          initialData[key] = '';
        } else if (type === 'select' && options.length > 0) {
          // 목록형: 첫 값 또는 빈 값
          initialData[key] = options[0] || '';
        } else {
          initialData[key] = '';
        }
      });
      setFormData(initialData);
      console.log('Initial form data set:', initialData);
      setValidationErrors({});
      await AsyncStorage.setItem('uploadMode', mode);
      await AsyncStorage.setItem('prevUploadForm', JSON.stringify(detailForm));
      await AsyncStorage.setItem('prevUploadFormData', JSON.stringify(initialData));
    } catch (err) {
      Alert.alert('오류', '양식 상세 정보를 불러오지 못했습니다');
      setFormData({});
      setValidationErrors({});
    }
  }, [mode]);

  const validateForm = useCallback(async () => {
    if (!selectedForm) return false;
    const errors = {};
    selectedForm.fields.forEach(field => {
      const key = typeof field === 'object' ? field.name : field;
      if (!formData[key] || String(formData[key]).trim() === '') errors[key] = true;
    });
    setValidationErrors(errors);
    
    await AsyncStorage.setItem('prevUploadForm', JSON.stringify(selectedForm));
    await AsyncStorage.setItem('prevUploadFormData', JSON.stringify(formData));
    return Object.keys(errors).length === 0;
  }, [selectedForm, formData]);

  const updateField = useCallback((field, value) => {
    let newVal = value;
    if (/^\d{1,3}-\d{1,4}$/.test(value) && (field.includes('위치') || field.includes('호') || field.includes('동'))) {
      const [dong, ho] = value.split('-');
      newVal = `${dong}동-${ho}호`;
    }
    setFormData(prev => ({ ...prev, [field]: newVal }));
    setValidationErrors(prev => ({ ...prev, [field]: false }));
  }, []);

  const onDateChange = useCallback((event, date) => {
    if (!date) {
      setDatePickerField(null);
      return;
    }
    const iso = date.toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, [datePickerField]: iso }));
    setValidationErrors(prev => ({ ...prev, [datePickerField]: false }));
    setDatePickerField(null);
  }, [datePickerField]);

  // --- 테이블 계산 (useMemo를 사용하여 성능 최적화) ---
  
  const { entries, tableConfig } = useMemo(() => {
    // entries에 type, options 포함 (field 객체에서 직접)
    const entries = (selectedForm?.fields || []).map(field => {
      let type = 'text';
      let options = [];
      if (typeof field === 'object') {
        type = field.type || 'text';
        options = Array.isArray(field.options) ? field.options : [];
      }
      return { field, type, options };
    });
    
    // fontPx 추출 및 fontSize 계산 (캔버스 비율에 맞춤)
    const fontPx = parseInt(((canvasConfig.table.font || '').match(/(\d+)px/) || [])[1] || '16', 10);
    const fontSize = Math.max(10, Math.floor(CANVAS_WIDTH * fontPx / canvasConfig.width));
    
    // 최소 너비 및 텍스트 너비 계산 (한글 4글자 기준, 실제 필드명 중 가장 긴 글자수 기준)
    const minCol1Width = fontSize * 4 * 1.1; // 한글 4글자 기준
    const minCol2Width = fontSize * 9 * 1.1;
    let col1Width = CANVAS_WIDTH * canvasConfig.table.col1Ratio * (2 / 3);
    // 필드명이 객체일 경우 name을 사용
    let col1TextMax = Math.max(...entries.map(e => {
      const fieldName = typeof e.field === 'object' ? (e.field.name || '') : e.field;
      return (fieldName.length * fontSize * 0.6);
    }), 0);
    let col2TextMax = Math.max(...entries.map(e => {
      const fieldName = typeof e.field === 'object' ? (e.field.name || '') : e.field;
      return ((formData[fieldName] || '').length * fontSize * 0.6);
    }), 0);
    let col1FinalWidth = Math.max(col1Width, minCol1Width, col1TextMax + cellPaddingX * 2 + 12);
    let col2FinalWidth = Math.max(minCol2Width, col2TextMax + cellPaddingX * 2 + 12);
    
    let MIN_TABLE_WIDTH = CANVAS_WIDTH * canvasConfig.table.widthRatio;
    let tableWidth = Math.max(MIN_TABLE_WIDTH, col1FinalWidth + col2FinalWidth);
    let MAX_TABLE_WIDTH = CANVAS_WIDTH * 0.95;
    
    if (tableWidth > MAX_TABLE_WIDTH) {
      tableWidth = MAX_TABLE_WIDTH;
      col1FinalWidth = Math.max(col1Width, minCol1Width);
      col2FinalWidth = tableWidth - col1FinalWidth;
    }

    // 높이 계산 (테두리 포함 문제 해결)
    const rowHeight = fontSize * 2.0;
    const borderWidth = canvasConfig.table.borderWidth || 1;
    // 행 구분선 두께를 포함하여 최종 표 높이 계산
    const innerBorderAdjustment = (entries.length > 0 ? entries.length - 1 : 0) * borderWidth; 
    const tableHeight = (entries.length * rowHeight) ;
    // const tableHeight = (entries.length * rowHeight) + innerBorderAdjustment + (borderWidth * 2);

    const tableConfig = {
      col1FinalWidth, col2FinalWidth, tableWidth, tableHeight, cellPaddingX, cellPaddingY,
      fontSize, rowHeight, // ImageComposer에서 사용할 행 높이
      backgroundColor: canvasConfig.table.backgroundColor,
      borderColor: canvasConfig.table.borderColor,
      borderWidth: canvasConfig.table.borderWidth,
      textColor: canvasConfig.table.textColor,
    };

    return { entries, tableConfig };
  }, [selectedForm, formData]);

return {
  // 상태
  user, forms, selectedForm, formData, loading, validationErrors, datePickerField, 
  
  // 🟢 [추가] setFormData
  setFormData, // 💡 전역 formData 상태 설정 함수 추가
  
  // 이미지 관련 상태 (UploadEachScreen에서 필요) - 더미 값
  images: [], setImages: () => {}, 
  selectedImageIndex: null, setSelectedImageIndex: () => {},
  uploadedThumbnails: [], setUploadedThumbnails: () => {},
  rotation: 0, setRotation: () => {},
  uploading: false, setUploading: () => {},
  uploadProgress: 0, setUploadProgress: () => {},
  saving: false, setSaving: () => {},
  canvasRef: null,
  
  // 유틸리티/계산 값
  CANVAS_WIDTH, CANVAS_HEIGHT, entries, tableConfig,
  
  // 핸들러
  handleSelectForm, validateForm, updateField, onDateChange, setDatePickerField,
};
};