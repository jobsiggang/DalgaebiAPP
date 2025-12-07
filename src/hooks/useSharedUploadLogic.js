// src/hooks/useSharedUploadLogic.js

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Alert, Dimensions, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { canvasConfig } from '../config/compositeConfig'; 
import API from '../config/api'; 


const { width: screenWidth } = Dimensions.get('window');

// 캔버스 크기 계산 유틸리티 (미리보기 크기)
function getPreviewDims(selectedForm) {
  // 화면 너비의 90% 사용 (flexible)
  const baseWidth = Math.floor(screenWidth * 0.9);
  // 선택된 폼의 해상도 비율 사용 (없으면 기본값)
  let res = selectedForm?.resolution;
  if (!res || typeof res.width !== 'number' || typeof res.height !== 'number') {
    res = { width: canvasConfig.width || 1024, height: canvasConfig.height || 768 };
  }
  const aspectRatio = res.width / res.height;
  // width 기준으로 height 자동 계산
  const baseHeight = Math.floor(baseWidth / aspectRatio);
  return { width: baseWidth, height: baseHeight };
}

export const useSharedUploadLogic = (navigation, route, mode = 'each') => {
  // --- 상태 정의 ---
  const [user, setUser] = useState(null);
  const [forms, setForms] = useState([]);
  const [selectedForm, setSelectedForm] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const [datePickerField, setDatePickerField] = useState(null);
  const [configVersion, setConfigVersion] = useState(0);

  // previewDims를 selectedForm이 바뀔 때마다 재계산
  const previewDims = getPreviewDims(selectedForm);
  const cellPaddingX = canvasConfig.table.cellPaddingX;
  const cellPaddingY = canvasConfig.table.cellPaddingY;

  useEffect(() => {
    loadUser();
    fetchForms();
    requestCameraPermission();
    restoreUploadState();
  }, []);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
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
      if (!userObj?.token || !userObj.companyId || !userObj.teamId) {
        Alert.alert('오류', '로그인이 필요하거나 권한 정보가 부족합니다.');
        setLoading(false); 
        return;
      }

      const companyId = userObj.companyId;
      const teamId = userObj.teamId;
        
      const url = `${API.companyTeamsBase}/${companyId}/teams/${teamId}/forms`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${userObj.token}`, 'Content-Type': 'application/json' },
      });
        
      const data = await res.json();
      
      if (data.success) {
        setForms((data.forms || []).filter(f => f.isActive !== false).map(f => ({
          ...f,
          fields: Array.isArray(f.fields) ? f.fields : [],
        })));
      } else {
        Alert.alert('오류', data.error || '양식 목록을 불러올 수 없습니다.');
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
      return;
    }
    
    if (route?.params?.restoreForm) {
      const prevForm = await AsyncStorage.getItem('prevUploadForm');
      const prevFormData = await AsyncStorage.getItem('prevUploadFormData');
      if (prevForm) setSelectedForm(JSON.parse(prevForm));
      if (prevFormData) setFormData(JSON.parse(prevFormData));
    }
  };

  const handleSelectForm = useCallback(async (form) => {
    setSelectedForm(form);
    try {
      const userData = await AsyncStorage.getItem('user');
      const userObj = userData ? JSON.parse(userData) : null;
      if (!userObj?.token || !userObj.companyId || !userObj.teamId || userObj.isActive === false) {
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
        let key = typeof field === 'object' ? field.name : field;
        let type = 'text';
        let options = [];
        if (typeof field === 'object') {
          type = field.type || 'text';
          options = Array.isArray(field.options) ? field.options : [];
        }
        if (type === 'date') {
          initialData[key] = today;
        } else if (type === 'number') {
          initialData[key] = '';
        } else if (type === 'select' && options.length > 0) {
          initialData[key] = options[0] || '';
        } else {
          initialData[key] = '';
        }
      });
      setFormData(initialData);
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
    if (/^\d{1,3}-\d{1,4}$/.test(value) && (field.includes('호') || field.includes('동'))) {
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

  const { entries, tableConfigPreview, tableConfigHiRes, hiResDims, calculateTableConfig } = useMemo(() => {
    const entries = (selectedForm?.fields || []).map(field => {
      let type = 'text';
      let options = [];
      if (typeof field === 'object') {
        type = field.type || 'text';
        options = Array.isArray(field.options) ? field.options : [];
      }
      return { field, type, options };
    });

    // 1. 고해상도 (Hi-Res) 기준: 세로/가로 방향에 맞춰 자동 조정
    let hiResResolution = selectedForm?.resolution;
    if (!hiResResolution || typeof hiResResolution.width !== 'number' || typeof hiResResolution.height !== 'number') {
      hiResResolution = { width: canvasConfig.width || 1024, height: canvasConfig.height || 768 };
    }
    const hiResDims = {
      width: Math.max(hiResResolution.width, hiResResolution.height),
      height: Math.min(hiResResolution.width, hiResResolution.height),
    };

    // 2. 미리보기 (Preview) 비율 계산
    const previewScale = previewDims.width / hiResDims.width;

    // 3. DB 표 스타일/색상/폰트/배경 매핑
    const colorMap = {
      white: { bg: '#ffffff', text: '#000000', border: '#aaaaaa' }, 
      black: { bg: '#222222', text: '#ffffff', border: '#ffffff' }, 
    };
    
    const boardBackground = selectedForm?.boardBackground || 'white';
    const boardFont = selectedForm?.boardFont || 'System';
    const boardPosition = selectedForm?.boardPosition || 'bottomLeft';
    const boardSize = selectedForm?.boardSize || '100%';
    
    const colors = colorMap[boardBackground] || colorMap['white'];
    const sizeMultiplier = parseFloat(boardSize.replace('%', '')) / 100;
    const boardFontFamily = boardFont !== 'System' ? boardFont : undefined;

    // 4. 🚨 통일된 테이블 설정 계산 함수 (해상도 기반) - hiResDims 정의 후에 선언
    const calculateTableConfig = (targetDims) => {
      const configFontBasePx = canvasConfig.table.fontBasePx || 16;
      const baseFontPx = boardFont === 'System' ? configFontBasePx : configFontBasePx + 2;
      // 폰트 크기: 기본 해상도(hiResDims.width)를 기준으로 목표 해상도에 맞춰 계산
      const fontSize = Math.max(10, Math.floor((baseFontPx / hiResDims.width) * targetDims.width));

      const minCol1Width = fontSize * 5 * 1.1;
      const minCol2Width = fontSize * 8 * 1.1;

      // 문자당 픽셀 환산값을 조금 더 넉넉하게 잡아 텍스트가 잘리지 않도록 함
      const charPx = fontSize * 1;

      let col1TextMax = Math.max(...entries.map(e => {
        const fieldName = typeof e.field === 'object' ? (e.field.name || '') : e.field;
        return (fieldName.length * charPx);
      }), 0);
      let col2TextMax = Math.max(...entries.map(e => {
        const fieldName = typeof e.field === 'object' ? (e.field.name || '') : e.field;
        return ((formData[fieldName] || '').length * charPx);
      }), 0);

      const paddingTotal = (cellPaddingX || 0) * 2;
      let col1FinalWidth = Math.max(minCol1Width, col1TextMax + paddingTotal);
      let col2FinalWidth = Math.max(minCol2Width, col2TextMax + paddingTotal);

      // 글자가 길면 너비를 늘려주고, 전체 표 너비는 캔버스 너비 이내로 유지
      let tableWidth = col1FinalWidth + col2FinalWidth;

      const rowHeight = Math.max(Math.round(fontSize * 2.4), fontSize * 2);
      const borderWidth = canvasConfig.table.borderWidth || 1;
      const tableHeight = (entries.length * rowHeight);

      // 텍스트 색상이 흰색이면 테두리도 흰색으로 설정
      let finalBorderColor = colors.border;
      if (colors.text === '#ffffff') {
        finalBorderColor = '#ffffff';
      }

      return {
        col1FinalWidth, col2FinalWidth, tableWidth, tableHeight, 
        fontSize, rowHeight, 
        cellPaddingX: cellPaddingX,
        cellPaddingY: cellPaddingY,
        backgroundColor: colors.bg, 
        textColor: colors.text, 
        borderColor: finalBorderColor,
        borderWidth,
        fontFamily: boardFontFamily,
        boardPosition,
        boardBackground,
      };
    };

    // 5. 설정값 분리 및 안전한 기본값 반환
    if (!selectedForm || entries.length === 0) {
      const defaultTableConfig = calculateTableConfig(hiResDims);
      defaultTableConfig.boardPosition = 'bottomLeft';
      defaultTableConfig.backgroundColor = colorMap['white'].bg;
      defaultTableConfig.textColor = colorMap['white'].text;
      defaultTableConfig.borderColor = colorMap['white'].border;

      return { 
        entries: [], 
        calculateTableConfig,
        tableConfigPreview: calculateTableConfig(previewDims), 
        tableConfigHiRes: calculateTableConfig(hiResDims), 
        hiResDims,
      };
    }
    
    const tableConfigHiRes = calculateTableConfig(hiResDims);
    const tableConfigPreview = calculateTableConfig(previewDims);

    return { entries, calculateTableConfig, tableConfigPreview, tableConfigHiRes, hiResDims };
  }, [selectedForm, formData]);
  
  useEffect(() => {
    if (selectedForm && tableConfigHiRes?.col1FinalWidth) { 
      setConfigVersion(v => v + 1);
    }
  }, [tableConfigHiRes?.col1FinalWidth, tableConfigHiRes?.col2FinalWidth, selectedForm]);

  return {
    user, forms, selectedForm, formData, loading, validationErrors, datePickerField, configVersion,
    setFormData,
    images: [], setImages: () => {}, 
    selectedImageIndex: null, setSelectedImageIndex: () => {},
    uploadedThumbnails: [], setUploadedThumbnails: () => {},
    rotation: 0, setRotation: () => {},
    uploading: false, setUploading: () => {},
    uploadProgress: 0, setUploadProgress: () => {},
    saving: false, setSaving: () => {},
    canvasRef: null,
    previewDims, hiResDims, entries, tableConfigPreview, tableConfigHiRes, calculateTableConfig,
    handleSelectForm, 
    validateForm, 
    updateField, 
    onDateChange, 
    setDatePickerField,
  };
};
