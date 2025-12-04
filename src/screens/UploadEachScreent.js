// src/screens/UploadEachScreen.js

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Image, TextInput, StyleSheet, Alert,
    ActivityIndicator, StatusBar, Dimensions, PermissionsAndroid, Platform, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { saveCompositeImageToPhone } from '../hooks/useCompositeImageSaver';
import Geolocation from 'react-native-geolocation-service';
import Share from 'react-native-share';
import ImageResizer from 'react-native-image-resizer';
import { useFocusEffect } from '@react-navigation/native';
import FormField from '../components/FormField.js';

// 공통 컴포넌트/훅 import
import ImageComposer from '../components/ImageComposer';
import { useSharedUploadLogic } from '../hooks/useSharedUploadLogic';
import API from '../config/api';
import { canvasConfig } from '../config/compositeConfig'; 
import styles from './styles/UploadCommonStyles.js';


const { width: screenWidth } = Dimensions.get('window');

const { width: CANVAS_WIDTH, height: CANVAS_HEIGHT } = {
    width: Math.floor(screenWidth * 0.7),
    height: Math.floor((Math.floor(screenWidth * 0.7) * canvasConfig.height) / canvasConfig.width)
};


/* ---------------------------
  내부 UI 컴포넌트 (FormField, ThumbnailList)
---------------------------*/




const ThumbnailList = React.memo(({ thumbnails, onSelectThumbnail, selectedUri }) => (
    <View style={{ marginTop: 20, marginBottom: 16 }}>
        <Text style={styles.sectionTitle}>최근 합성 이미지 ({thumbnails.length}개)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {thumbnails.map((item, idx) => (
                <TouchableOpacity
                    key={idx}
                    onPress={() => onSelectThumbnail(item)}
                    style={{ marginRight: 12 }}
                >
                    <Image
                        source={{ uri: item.uri }}
                        style={{ 
                            width: 120, 
                            height: 90, 
                            borderRadius: 8, 
                            borderWidth: 3, 
                            borderColor: selectedUri === item.uri ? '#2563eb' : '#d1d5db' 
                        }}
                    />
                    <Text style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 10, backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', paddingHorizontal: 4, borderRadius: 2 }}>
                        {item.snapshot['일자'] ? item.snapshot['일자'].substring(5) : '기록됨'}
                    </Text>
                </TouchableOpacity>
            ))}
        </ScrollView>
    </View>
));


/* ---------------------------
  메인 컴포넌트: UploadEachScreen
---------------------------*/

const UploadEachScreen = ({ navigation, route }) => {
    // 1. 공통 훅 사용
    const sharedLogic = useSharedUploadLogic(navigation, route, 'each'); 

    // 2. 이미지/업로드 관련 상태 (로컬 상태 유지)
    const [items, setItems] = useState([]); // { id, uri, rotation, formDataSnapshot } 배열
    const [selectedItemId, setSelectedItemId] = useState(null); 
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadedThumbnails, setUploadedThumbnails] = useState([]); // 썸네일 목록 상태 추가
    const canvasRef = useRef(null); // 프리뷰용(저해상도)
    const hiResCanvasRef = useRef(null); // 고해상도 캡처용
    const [canvasImageUri, setCanvasImageUri] = useState(null); // 캔버스 전용 이미지 URI
    const [images, setImages] = useState([]); // 원본 이미지 배열
    const [selectedImageIndex, setSelectedImageIndex] = useState(null); // 선택된 이미지 인덱스
    const [selectedImage, setSelectedImage] = useState(null); // 선택된 이미지 객체
    const [currentRotation, setCurrentRotation] = useState(0); // 현재 선택된 이미지의 회전 값
    const [pendingUpload, setPendingUpload] = useState(null); // 업로드 대기 이미지/URI
    // 계산된 상태
    const selectedItem = items.find(item => item.id === selectedItemId);
    // const currentRotation = selectedItem?.rotation || 0; 
    

    const { 
        user, forms, selectedForm, formData, validateForm, 
        updateField, onDateChange, setDatePickerField, validationErrors, 
        setFormData, // 💡 setFormData 추가
        handleSelectForm 
    } = sharedLogic;
    const { 
        CANVAS_WIDTH: C_W = 0, 
        CANVAS_HEIGHT: C_H = 0, 
        entries = [], 
        tableConfig = {} 
    } = sharedLogic;
    

   // 🚀 모드 설정
useFocusEffect(
    React.useCallback(() => {
        const saveMode = async () => {
            await AsyncStorage.setItem('uploadMode', 'each');
        };
        saveMode();
    }, [])
);

useFocusEffect(
    React.useCallback(() => {
        const saveModeAndCheckNavigation = async () => {
            await AsyncStorage.setItem('uploadMode', 'each'); 
        };
        saveModeAndCheckNavigation();
    }, [])
);
useEffect(() => {
    if (pendingUpload && items.length > 0) {
        handleApplyAndUpload(pendingUpload.image, pendingUpload.uri);
        setPendingUpload(null);
    }
}, [items, pendingUpload]);
// 💡 [핵심 - 캔버스 상태 변화 시 items 1개로 동기화]
useEffect(() => {
    if (!canvasImageUri) return;
    setItems([{
        id: 'each',
        uri: canvasImageUri,
        rotation: currentRotation,
        formDataSnapshot: { ...formData },
    }]);
    setSelectedItemId('each');
}, [canvasImageUri, currentRotation, formData]);
    // 💡 썸네일 선택 처리 함수: 캔버스 이미지와 폼 데이터 모두 변경
    const onSelectThumbnail = useCallback((item) => {
        setCanvasImageUri(item.uri);
        if (item.snapshot) {
            sharedLogic.setFormData(item.snapshot);
        }
        // // 원본 이미지 정보는 삭제 (썸네일이므로 원본 편집 불가)
        setImages([]);
        setSelectedImageIndex(null);
        setCurrentRotation(0); // 썸네일 선택 시 회전값 초기화
        // 자동 저장/전송 동작 없음 (버튼만 활성화)
    }, [sharedLogic.setFormData]); 

    // 🟢 [수정] 적용 버튼 로직: 저장 후 업로드 (수동 실행의 목표 함수)
   const handleApplyAndUpload = async (imageParam, uriParam) => {
    const hasImage = imageParam || selectedImage || uriParam || canvasImageUri;
    if (!hasImage) {
        Alert.alert('오류', '캔버스에 사진이 선택되지 않았습니다.');
        return;
    }

  

    const valid = await validateForm();
    if (!valid) {
        Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
        return;
    }
    try {
        await handleUpload(imageParam, uriParam);
    } catch (e) {
        console.error('Apply sequence failed', e);
    }
};
    // [NEW] 양식 선택 및 이미지 초기화 통합 함수
    const handleFormSelectionAndReset = useCallback((form) => {
        setImages([]);
        setSelectedImageIndex(null);
        setCanvasImageUri(null);
        handleSelectForm(form); 
        // 🚨 양식 변경 시 기존 썸네일 리스트도 비움
        setUploadedThumbnails([]); 
    }, [setImages, setSelectedImageIndex, handleSelectForm, setUploadedThumbnails]);
    
    // handleImagePickerResponse: 이미지 선택 완료 후 로직
 const handleImagePickerResponse = useCallback((response) => {
    if (!response.didCancel && !response.errorCode && response.assets?.[0]) {
        const asset = response.assets[0];
        const newImage = { ...asset, rotation: 0 };
        setImages([newImage]);
        setSelectedImageIndex(0);
        setCanvasImageUri(newImage.uri);
        setCurrentRotation(0);
        const newItem = {
            id: `item_${Date.now()}`,
            uri: newImage.uri,
            rotation: 0,
            formDataSnapshot: { ...formData },
        };
        setItems(prev => [...prev, newItem]);
        setSelectedItemId(newItem.id);
        setPendingUpload({ image: newImage, uri: newImage.uri });
    }
}, [formData]);

    const takePicture = useCallback(async () => {
        const valid = await validateForm();
        if (!valid) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
        launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: false, selectionLimit: 1 }, handleImagePickerResponse);
    }, [validateForm, handleImagePickerResponse]);

    const pickImage = useCallback(async () => {
        const valid = await validateForm();
        if (!valid) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요 (빨간색 표시된 항목)');
        launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 }, handleImagePickerResponse);
    }, [validateForm, handleImagePickerResponse]);

    // 회전 로직
    const rotateImage = useCallback(() => {
        if (selectedImageIndex !== null) {
            // 원본 이미지 회전
            setImages(prevImages => {
                const newImages = [...prevImages];
                const currentImage = newImages[selectedImageIndex];
                const newRotation = (currentImage.rotation || 0) + 90;
                currentImage.rotation = newRotation % 360;
                setCurrentRotation(currentImage.rotation); // 동기화
                return newImages;
            });
        } else if (canvasImageUri) {
            // 썸네일(캔버스 전용) 회전
            setCurrentRotation(r => (r + 90) % 360);
        }
    }, [selectedImageIndex, canvasImageUri]);


    // 🟢 saveToPhone: 캔버스 캡처본을 휴대폰에 저장
    const saveToPhone = async (imageParam, uriParam) => {
        const img = imageParam || selectedImage;
        const uri = uriParam || canvasImageUri;
        if (!img && !uri) return;
        if (!hiResCanvasRef.current && !canvasRef.current && !uri) throw new Error('캔버스 참조를 찾을 수 없습니다.');

        setSaving(true);
        try {
            await new Promise(r => setTimeout(r, 120));
            let compositeUri;
            // 고해상도 캔버스 우선 사용
            if (hiResCanvasRef.current && hiResCanvasRef.current.capture) {
                compositeUri = await hiResCanvasRef.current.capture();
            } else if (canvasRef.current && canvasRef.current.capture) {
                compositeUri = await canvasRef.current.capture();
            } else if (uri) {
                compositeUri = uri;
            } else {
                throw new Error('저장할 이미지가 없습니다');
            }
            // 원본 저장 (사진 촬영 시만, 옵션 체크)
            if (canvasConfig.saveOriginalPhoto && img?.uri && img?.fileName) {
                const origDir = Platform.OS === 'android' ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/${canvasConfig.saveFolder}` : `${RNFS.PicturesDirectoryPath}/${canvasConfig.saveFolder}`;
                const origExists = await RNFS.exists(origDir);
                if (!origExists) { await RNFS.mkdir(origDir); }
                const origPath = `${origDir}/ORIGINAL_${img.fileName}`;
                await RNFS.copyFile(img.uri, origPath);
            }
            // 위치정보 저장 (옵션 체크)
            let location = null;
            if (canvasConfig.useLocation) {
                try {
                    location = await new Promise((resolve, reject) => {
                        Geolocation.getCurrentPosition(
                            pos => resolve(pos.coords),
                            err => resolve(null),
                            { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
                        );
                    });
                } catch (e) { location = null; }
            }
            // dalgaebi 폴더 저장
            const fileName = `합성이미지_1_${Date.now()}.jpg`;
            const destDir = Platform.OS === 'android' ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/${canvasConfig.saveFolder}` : `${RNFS.PicturesDirectoryPath}/${canvasConfig.saveFolder}`;
            const dirExists = await RNFS.exists(destDir);
            if (!dirExists) { await RNFS.mkdir(destDir); }
            const destPath = `${destDir}/${fileName}`;
            await RNFS.copyFile(compositeUri, destPath);
            if (Platform.OS === 'android' && RNFS.scanFile) { try { await RNFS.scanFile(destPath); } catch (e) { /* ignore */ } }
            // 위치정보를 별도 파일로 저장 (예시)
            if (location) {
                const locPath = `${destDir}/${fileName.replace('.jpg', '.json')}`;
                await RNFS.writeFile(locPath, JSON.stringify(location), 'utf8');
            }
        } catch (err) {
            console.error('Save error:', err);
            Alert.alert('오류', '이미지 저장에 실패했습니다\n' + (err.message || err));
            throw err;
        } finally {
            setSaving(false);
        }
    };
    // 공통 저장 로직으로 분리

    // 🟢 handleUpload: MultiPart/form-data 방식으로 전송
   const handleUpload = async () => {
    if (!selectedForm) return Alert.alert('오류', '양식을 선택해주세요');
    if (items.length === 0) return Alert.alert('오류', '사진을 추가해주세요');
    if (!validateForm()) return Alert.alert('입력 오류', '현재 선택된 항목의 필수 항목을 입력해주세요');
    
    // Auto-save logic has ensured all item data is current in the 'items' array.
    
    setUploading(true);
    setUploadProgress(0);

    const initialSelectedItemId = selectedItemId;
    const initialFormData = { ...formData };
    
    // 🟢 [핵심 수정] MultiPart FormData 객체 생성
    const uploadFormData = new FormData();
    const totalCount =1;

    try {
        const userData = await AsyncStorage.getItem('user');
        const userObj = userData ? JSON.parse(userData) : null;
        if (!userObj?.token) {
            Alert.alert('오류', '로그인이 필요합니다.');
            navigation.replace('Login');
            return;
        }

        // 1. 🚨 Global Metadata 추가 (서버가 먼저 읽을 정보)
        
        uploadFormData.append('formId', selectedForm._id);
        uploadFormData.append('formName', selectedForm.formName);
        uploadFormData.append('totalCount', String(totalCount));
        uploadFormData.append('representativeData', JSON.stringify(items[0].formDataSnapshot));
        
        const uploadedThumbnailsData = [];

        // 2. 이미지별 데이터 적용, 캡처, 리사이징 및 FormData 구성 루프
        for (let i = 0; i < totalCount; i++) {
            const item = items[i];
            const index = i + 1;
            
            // 캔버스 렌더링을 위해 임시 상태 로드 (리렌더링 유도)
            setSelectedItemId(item.id);
            setFormData(item.formDataSnapshot);
            await new Promise(r => setTimeout(r, 150)); 
            if (!canvasRef.current) continue;
            

            // 2-1. 고해상도 캔버스 캡처
            // hiResCanvasRef가 있으면 고해상도, 없으면 기존 방식 fallback
            let compositeUri;
            if (hiResCanvasRef.current && hiResCanvasRef.current.capture) {
                compositeUri = await hiResCanvasRef.current.capture();
            } else {
                compositeUri = await canvasRef.current.capture();
            }
            await saveCompositeImageToPhone({ compositeUri, img: item, index }); // 휴대폰 저장 (공통 로직)
            // 2-2. 업로드용 파일 지정
            const finalCompositeUri = compositeUri;

            // 2-3. 썸네일 생성 (Multipart 전송용)
            const thumb = await ImageResizer.createResizedImage(finalCompositeUri, 200, 150, 'JPEG', 80);
            const thumbnailUri = thumb.uri; 

            const filename = `${selectedForm.formName}_${index}_${Date.now()}.jpg`;

            // 3. 🟢 [핵심] FormData에 개별 파일 및 데이터 추가 (JSON 구조 배제)
            uploadFormData.append(`file_${i}`, { // 고유 키 사용: file_0, file_1, ...
                uri: finalCompositeUri,
                type: 'image/jpeg',
                name: filename,
            });
            uploadFormData.append(`thumbnail_${i}`, { // 고유 키 사용: thumbnail_0, thumbnail_1, ...
                uri: thumbnailUri,
                type: 'image/jpeg',
                name: `thumb_${filename}`,
            });
            uploadFormData.append(`fieldData_${i}`, JSON.stringify(item.formDataSnapshot)); // 데이터 스냅샷 JSON 문자열

            // 클라이언트 UI 썸네일 업데이트 (Base64로 변환하여 UI에 즉시 표시)
            const thumbBase64 = await RNFS.readFile(thumbnailUri, 'base64');
            const thumbnailBase64DataUrl = `data:image/jpeg;base64,${thumbBase64}`;
            uploadedThumbnailsData.push({ uri: thumbnailBase64DataUrl, snapshot: item.formDataSnapshot });

            setUploadProgress(Math.round((index / totalCount) * 100));
        }
        
        // 4. 서버에 전송 (단일 Multipart 요청)
        const resp = await fetch(API.uploadPhoto, { 
            method: 'POST',
            headers: {
                Authorization: `Bearer ${userObj.token}`,
                // Content-Type: 'multipart/form-data'는 fetch가 자동으로 설정
            },
            body: uploadFormData, // 🚨 FormData 객체 전송
        });

        const data = await resp.json();
        
        if (data?.success) {
            Alert.alert('성공', `이미지가 성공적으로 전송 및 기록되었습니다.`);
        } else {
            console.error('Upload failed:', data);
            Alert.alert('업로드 실패', data?.error || '서버 응답 오류 (DB 기록 포함 실패)');
        }
        // 업로드 성공/실패와 무관하게 썸네일 리스트를 UI에 반영
        setUploadedThumbnails(uploadedThumbnailsData);
    } catch (err) {
        console.error('Upload error:', err);
        Alert.alert('오류', '업로드 중 오류가 발생했습니다\n' + (err.message || err));
        setUploadedThumbnails(uploadedThumbnailsData); // 실패해도 썸네일 반영
    } finally {
        setUploading(false);
        setUploadProgress(0);
    }
};

    const handleKakaoShare = async () => {
        if (!selectedImage && !canvasImageUri) return;
        if (!canvasRef.current && !canvasImageUri) throw new Error('캔버스 참조를 찾을 수 없습니다.');
        setSaving(true);
        try {
            await new Promise(r => setTimeout(r, 120));
            let compositeUri;
            if (selectedImage && canvasRef.current) {
                compositeUri = await canvasRef.current.capture();
            } else if (canvasImageUri) {
                compositeUri = canvasImageUri;
            } else {
                throw new Error('공유할 이미지가 없습니다.');
            }

            const shareOptions = {
                title: '이미지 공유',
                url: compositeUri,
                social: Share.Social.KAKAO,
            };

            await Share.shareSingle(shareOptions);
        } catch (err) {
            console.error('Share error:', err);
            Alert.alert('오류', '공유 중 오류가 발생했습니다\n' + (err.message || err));
        } finally {
            setSaving(false);
        }
    };


    if (sharedLogic.loading || !user) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    // --- 렌더링 ---

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#3b82f6" />

            <ScrollView style={styles.content}>
                {/* 1. 양식 선택 */}
                <Text style={styles.sectionTitle}>입력 양식 선택</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ minHeight: 56, maxHeight: 72 }}>
                    {forms.map(form => (
                        <TouchableOpacity
                            key={form._id}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 18, marginRight: 10, borderWidth: 1, borderColor: selectedForm?._id === form._id ? '#2563eb' : '#d1d5db', borderRadius: 16, backgroundColor: selectedForm?._id === form._id ? '#e0e7ff' : '#fff', elevation: selectedForm?._id === form._id ? 2 : 0 }}
                            onPress={() => handleFormSelectionAndReset(form)}
                        >
                            <Text style={{ fontSize: 15, color: selectedForm?._id === form._id ? '#2563eb' : '#222', fontWeight: 'bold' }}>{form.formName}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* 2. 정보 입력 */}
                {selectedForm && (
                    <View>
                        <View style={{ marginBottom: 16 }}>
                            <View style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                                {entries.map(entry => {
                                    // field가 객체일 경우 name/_id/string 변환
                                    const field = typeof entry.field === 'object'
                                        ? entry.field.name || entry.field._id || JSON.stringify(entry.field)
                                        : entry.field;
                                    const type = entry.type || 'text';
                                    const options = entry.options || null;
                                    const isDateField = type === 'date';
                                    // value가 객체일 경우 name/_id/string 변환
                                    const value = typeof formData[field] === 'object'
                                        ? formData[field]?.name || formData[field]?._id || ''
                                        : formData[field];
                                    // placeholder 지정
                                    let placeholder = field;
                                    if (type === 'date') placeholder = '날짜 선택';
                                    else if (type === 'number') placeholder = '숫자만 입력';
                                    else if (type === 'select') placeholder = '옵션 선택';
                                    return (
                                        <FormField
                                            key={field}
                                            field={field}
                                            value={value}
                                            onChange={val => updateField(field, val)}
                                            isDate={isDateField}
                                            options={options}
                                            validationError={!!validationErrors[field]}
                                            onOpenDatePicker={f => setDatePickerField(f)}
                                            type={type}
                                            placeholder={placeholder}
                                        />
                                    );
                                })}
                            </View>
                        </View>

                        {/* 날짜 피커 */}
                        {sharedLogic.datePickerField && (
                            <DateTimePicker
                                value={formData[sharedLogic.datePickerField] ? new Date(formData[sharedLogic.datePickerField]) : new Date()}
                                mode="date"
                                display="default"
                                onChange={sharedLogic.onDateChange}
                            />
                        )}
                        
                        {/* 3. 액션 버튼들 */}
                        <View>
                            <View style={styles.compactButtonRow}>
                                <TouchableOpacity style={styles.compactButton} onPress={takePicture} disabled={uploading || saving}>
                                    <Text style={styles.compactButtonText}>📷</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.compactButton} onPress={pickImage} disabled={uploading || saving}>
                                    <Text style={styles.compactButtonText}>🖼️</Text>
                                </TouchableOpacity>
                                

                                
                                <TouchableOpacity
                                    style={[styles.compactButton, styles.kakaoBtn, !selectedImage && !canvasImageUri && styles.buttonDisabled]}
                                    onPress={handleKakaoShare}
                                    disabled={(!selectedImage && !canvasImageUri) || uploading || saving}
                                >
                                    <Text style={styles.compactButtonText}>공유</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        
                        {/* 4. 미리보기(캔버스 + 표 오버레이) + 회전 버튼 */}
                        {selectedImage || canvasImageUri ? (
                            <>
                            {/* 프리뷰용(저해상도) */}
                            <View style={{ position: 'relative', width: C_W + 4, height: C_H + 4, alignItems: 'center', justifyContent: 'center' }}>
                                <ImageComposer
                                    ref={canvasRef}
                                    selectedImage={selectedImage || (canvasImageUri ? { uri: canvasImageUri, rotation: currentRotation, width: C_W, height: C_H } : null)}
                                    rotation={currentRotation}
                                    canvasDims={{ width: C_W, height: C_H }}
                                    tableEntries={entries}
                                    tableConfig={tableConfig}
                                    formData={formData}
                                />
                                {/* 🔄 회전 버튼 */}
                                <TouchableOpacity
                                    style={{ position: 'absolute', top: 12, right: 60, backgroundColor: '#2eb02eff', borderRadius: 20, padding: 10, elevation: 3 }}
                                    onPress={rotateImage}
                                    disabled={uploading || saving || (!selectedImage && !canvasImageUri)}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20 }}>⟳</Text>
                                </TouchableOpacity>
                                {/* 🚨 적용 버튼 (수동 실행) */}
                                <TouchableOpacity
                                    style={{ 
                                        position: 'absolute', 
                                        top: 12, 
                                        right: 12, 
                                        backgroundColor: '#d24ca8ff', 
                                        borderRadius: 20, 
                                        padding: 10, 
                                        elevation: 3 
                                    }}
                                    onPress={handleApplyAndUpload} // 👈 저장 및 업로드 실행
                                    disabled={uploading || saving || (!selectedImage && !canvasImageUri)}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 20 }}>✔</Text>
                                </TouchableOpacity>
                            </View>
                            {/* 고해상도 캔버스(숨김, 캡처용) - 반드시 실제 해상도로 렌더링 */}
                            <View
                                style={{
                                    width: canvasConfig.width,
                                    height: canvasConfig.height,
                                    position: 'absolute',
                                    left: -9999,
                                    top: -9999,
                                    opacity: 0,
                                    zIndex: -9999,
                                }}
                                pointerEvents="none"
                            >
                                <ImageComposer
                                    ref={hiResCanvasRef}
                                    selectedImage={selectedImage || (canvasImageUri ? { uri: canvasImageUri, rotation: currentRotation, width: canvasConfig.width, height: canvasConfig.height } : null)}
                                    rotation={currentRotation}
                                    canvasDims={{ width: canvasConfig.width, height: canvasConfig.height }}
                                    tableEntries={entries}
                                    tableConfig={tableConfig}
                                    formData={formData}
                                />
                            </View>
                            </>
                        ) : null}

                        {/* 5. 썸네일 리스트 */}
                        {uploadedThumbnails.length > 0 && (
                            <ThumbnailList 
                                thumbnails={uploadedThumbnails} 
                                onSelectThumbnail={onSelectThumbnail} 
                                selectedUri={canvasImageUri}
                            />
                        )}
                    </View>
                )}
            </ScrollView>

            {/* 업로드 진행 UI */}
            <View style={{ width: '100%', padding: 12, marginTop: 24, alignItems: 'center' }}>
                {uploading && (
                    <View style={{ width: '100%', padding: 8, backgroundColor: '#ffffff', borderRadius: 8, marginBottom: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, color: '#111827', marginBottom: 4 }}>
                            {uploadProgress}% 전송 중... (속도 개선 적용됨)
                        </Text>
                        <View style={{ width: '100%', height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                            <View style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: '#2563eb' }} />
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
};


export default UploadEachScreen;