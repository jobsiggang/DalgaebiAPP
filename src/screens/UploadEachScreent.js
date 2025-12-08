// src/screens/UploadEachScreen.js

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Image, Alert,
    ActivityIndicator, StatusBar, Dimensions, PermissionsAndroid, Platform, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import RNFS from 'react-native-fs';
import { saveCompositeImageToPhone } from '../hooks/useCompositeImageSaver'; // 이 훅은 별도로 구현되었다고 가정
import Geolocation from 'react-native-geolocation-service';
import Share from 'react-native-share';
import ImageResizer from 'react-native-image-resizer';
import { useFocusEffect } from '@react-navigation/native';
import FormField from '../components/FormField.js';
import { canvasConfig } from '../config/compositeConfig'; 
// 공통 컴포넌트/훅 import
import ImageOverlay from '../components/ImageOverlay.js'; // 💡 NEW: 벡터 스케일링고해상도 캡처와 미리보기할때 같은 함수 사용할것이 파라미터만 다르게 보내
import { useSharedUploadLogic } from '../hooks/useSharedUploadLogic';
import ThumbnailList from '../components/ThumbnailList';
import API from '../config/api';
import styles from './styles/UploadCommonStyles.js'; // 💡 공용 스타일 import


/* ---------------------------
  내부 UI 컴포넌트 (ThumbnailList)
---------------------------*/

// ...공통 ThumbnailList 컴포넌트로 대체


/* ---------------------------
  메인 컴포넌트: UploadEachScreen
---------------------------*/

const UploadEachScreen = ({ navigation, route }) => {
    // 1. 공통 훅 사용 및 Ref 정의
    const sharedLogic = useSharedUploadLogic(navigation, route, 'each'); 
    const hiResCanvasRef = useRef(null); // 고해상도 캡처용

    // 2. 이미지/업로드 관련 상태 
    const [items, setItems] = useState([]); // { id, uri, rotation, formDataSnapshot } 배열
    const [selectedItemId, setSelectedItemId] = useState(null); 
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadedThumbnails, setUploadedThumbnails] = useState([]); 
    const [canvasImageUri, setCanvasImageUri] = useState(null); // 미리보기용 URI
    const [images, setImages] = useState([]); // 원본 이미지 배열
    const [selectedImageIndex, setSelectedImageIndex] = useState(null); 
    const [currentRotation, setCurrentRotation] = useState(0); 
    const [pendingUpload, setPendingUpload] = useState(null); 
    
    // 계산된 상태
    const selectedImage = images[selectedImageIndex] || null; // 선택된 원본 이미지 객체

    const { 
        user, forms, selectedForm, formData, validateForm, 
        updateField, onDateChange, setDatePickerField, validationErrors, 
        setFormData, handleSelectForm, 
        // 💡 벡터 스케일링 값
        previewDims, entries, tableConfigPreview, tableConfigHiRes, hiResDims, calculateTableConfig
    } = sharedLogic;
    
    // 🚀 모드 설정
    useFocusEffect(
        React.useCallback(() => {
            AsyncStorage.setItem('uploadMode', 'each');
        }, [])
    );
    // 🚨 실시간 tableConfig 계산 (formData 변경 시 즉시 반영)
    const dynamicTableConfigPreview = useMemo(() => {
        return calculateTableConfig(previewDims);
    }, [calculateTableConfig, previewDims, formData, tableConfigPreview, sharedLogic?.configVersion]);

    const dynamicTableConfigHiRes = useMemo(() => {
        return calculateTableConfig(hiResDims);
    }, [calculateTableConfig, hiResDims, formData, tableConfigHiRes, sharedLogic?.configVersion]);

    // 🚨 캔버스는 항상 고정 (회전 안함), 사진만 회전
    // rotatedCanvasDims 제거 - 캔버스는 항상 hiResDims 사용
    
    // 💡 [핵심 - 새로운 이미지 선택 시 items에 추가 (누적)]
    useEffect(() => {
        if (!selectedImage && !canvasImageUri) return;
        
        const newItem = {
            id: selectedImage?.uri || canvasImageUri, // 고유 ID로 이미지 URI 사용
            uri: (selectedImage || { uri: canvasImageUri }).uri,
            rotation: selectedImage?.rotation || currentRotation,
            formDataSnapshot: { ...formData },
        };

        // 이미 같은 URI가 있으면 업데이트, 없으면 추가
        setItems(prevItems => {
            const existingIndex = prevItems.findIndex(item => item.uri === newItem.uri);
            if (existingIndex >= 0) {
                // 기존 아이템 업데이트
                const updated = [...prevItems];
                updated[existingIndex] = newItem;
                return updated;
            } else {
                // 새 아이템 추가
                return [...prevItems, newItem];
            }
        });
        
        setSelectedItemId(newItem.id);
    }, [selectedImage, canvasImageUri, currentRotation, formData]);

    useEffect(() => {
        if (pendingUpload && items.length > 0) {
            // 자동 저장 및 업로드 시퀀스
            (async () => {
                try {
                    // 1단계: 합성 이미지 저장
                    await saveToPhone();
                    // 2단계: 자동 업로드
                    await handleUpload();
                } catch (err) {
                    console.error('Auto save/upload error:', err);
                }
            })();
            setPendingUpload(null);
        }
    }, [items, pendingUpload]);
    

    // 💡 썸네일 선택 처리 함수: 캔버스 이미지와 폼 데이터 모두 변경
    const onSelectThumbnail = useCallback((itemIdOrItem) => {
        // itemIdOrItem이 전체 item 객체일 수도, id만 올 수도 있음 (ThumbnailList에서 두 가지 경우 모두 처리)
        const item = typeof itemIdOrItem === 'object' ? itemIdOrItem : items.find(i => i.id === itemIdOrItem);
        
        if (!item) return;
        
        setCanvasImageUri(item.uri);
        // formDataSnapshot 복원 (정확한 속성명)
        if (item.formDataSnapshot) {
            sharedLogic.setFormData(item.formDataSnapshot);
        }
        // 회전 정보 복원
        if (item.rotation) {
            setCurrentRotation(item.rotation);
        }
        // 원본 이미지 정보는 삭제 (썸네일이므로 원본 편집 불가)
        setImages([]);
        setSelectedImageIndex(null);
    }, [sharedLogic.setFormData, items]); 

    // [NEW] 양식 선택 및 이미지 초기화 통합 함수
    const handleFormSelectionAndReset = useCallback((form) => {
        setImages([]);
        setSelectedImageIndex(null);
        setCanvasImageUri(null);
        setCurrentRotation(0);
        handleSelectForm(form); 
        setUploadedThumbnails([]);
        setItems([]);
        setSelectedItemId(null);
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
            // 🚨 자동 저장 및 업로드 플래그 설정 (useEffect에서 처리)
            setPendingUpload({ action: 'saveAndUpload' });
        }
    }, []);

    const takePicture = useCallback(async () => {
        const valid = await validateForm();
        if (!valid) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요');
        
        launchCamera({ 
            mediaType: 'photo', 
            quality: 0.8, 
            saveToPhotos: true,  // 🚨 원본을 휴대폰 카메라 폴더에 자동 저장
            selectionLimit: 1 
        }, handleImagePickerResponse);
    }, [validateForm, handleImagePickerResponse]);

    const pickImage = useCallback(async () => {
        const valid = await validateForm();
        if (!valid) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요');
        launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 }, handleImagePickerResponse);
    }, [validateForm, handleImagePickerResponse]);

    // 회전 로직
    const rotateImage = useCallback(() => {
        if (selectedImageIndex !== null) {
            setImages(prevImages => {
                const newImages = [...prevImages];
                const img = newImages[selectedImageIndex];
                img.rotation = (img.rotation || 0) + 90;
                setCurrentRotation(img.rotation);
                return newImages;
            });
        } else if (canvasImageUri) {
            setCurrentRotation(prev => (prev + 90) % 360);
        }
    }, [selectedImageIndex, canvasImageUri]);


    // 🟢 saveToPhone: 원본 이미지와 합성 이미지를 휴대폰에 저장
    const saveToPhone = async () => {
        const img = selectedImage;
        const uri = canvasImageUri;
        if (!img && !uri) return;
        if (!hiResCanvasRef.current && !uri) throw new Error('캔버스 참조를 찾을 수 없습니다.');

        setSaving(true);
        try {
            await new Promise(r => setTimeout(r, 120)); // 렌더링 대기
            let compositeUri;
            
            // 1. 고해상도 캔버스 캡처 (합성 이미지)
            compositeUri = await hiResCanvasRef.current.capture();
            
            // 2. 원본 이미지와 합성 이미지 함께 저장
            await saveCompositeImageToPhone({ 
                compositeUri, 
                originalUri: img?.uri || canvasImageUri,  // 🚨 원본 이미지 URI 추가
                img: img || items[0], 
                index: 1, 
                formData 
            }); 
            
            // 저장 완료는 조용히 처리 (자동 업로드 모드에서는 alert 표시 안 함)
            if (!pendingUpload) {
                Alert.alert('저장 완료', '원본 및 합성 이미지가 앨범에 저장되었습니다.');
            }

        } catch (err) {
            console.error('Save error:', err);
            Alert.alert('오류', '이미지 저장에 실패했습니다\n' + (err.message || err));
            throw err;
        } finally {
            setSaving(false);
        }
    };
    
    // 🟢 handleUpload: MultiPart/form-data 방식으로 전송
    const handleUpload = async () => {
        if (!selectedForm) return Alert.alert('오류', '양식을 선택해주세요');
        
        // items가 없으면 현재 상태에서 구성
        const uploadItems = items && items.length > 0 ? items : [{
            id: 'each',
            uri: (selectedImage || { uri: canvasImageUri }).uri,
            rotation: selectedImage?.rotation || currentRotation,
            formDataSnapshot: { ...formData },
        }];
        
        if (!uploadItems[0]?.uri) {
            return Alert.alert('오류', '사진을 추가해주세요');
        }
        
        setUploading(true);
        setUploadProgress(0);

        const uploadFormData = new FormData();
        const totalCount = uploadItems.length;

        try {
            const userData = await AsyncStorage.getItem('user');
            const userObj = userData ? JSON.parse(userData) : null;
            if (!userObj?.token) {
                Alert.alert('오류', '로그인이 필요합니다.');
                navigation.replace('Login');
                return;
            }

            // Global Metadata 추가
            uploadFormData.append('formId', selectedForm._id);
            uploadFormData.append('formName', selectedForm.formName);
            uploadFormData.append('totalCount', String(totalCount));
            uploadFormData.append('representativeData', JSON.stringify(uploadItems[0].formDataSnapshot));
            
            const uploadedThumbnailsData = [];

            // Phase 1: 이미지별 데이터 적용, 캡처, 리사이징 및 FormData 구성 루프 (0-90%)
            for (let i = 0; i < totalCount; i++) {
                const item = uploadItems[i];
                const index = i + 1;
                
                // 렌더링 완료 대기: 기본 200ms + requestAnimationFrame
                await new Promise(resolve => {
                    setTimeout(() => {
                        requestAnimationFrame(() => {
                            setTimeout(resolve, 200);
                        });
                    }, 200);
                });
                
                // 캔버스 캡처 (고해상도)
                let compositeUri = await hiResCanvasRef.current.capture();

                // 썸네일 생성
                const thumb = await ImageResizer.createResizedImage(compositeUri, 200, 150, 'JPEG', 80);
                const thumbnailUri = thumb.uri; 

                const filename = `${selectedForm.formName}_${index}_${Date.now()}.jpg`;

                // FormData에 개별 파일 및 데이터 추가
                uploadFormData.append(`file_${i}`, { 
                    uri: compositeUri,
                    type: 'image/jpeg',
                    name: filename,
                });
                uploadFormData.append(`thumbnail_${i}`, { 
                    uri: thumbnailUri,
                    type: 'image/jpeg',
                    name: `thumb_${filename}`,
                });
                uploadFormData.append(`fieldData_${i}`, JSON.stringify(item.formDataSnapshot));

                // 클라이언트 UI 썸네일 업데이트 (Base64)
                const thumbBase64 = await RNFS.readFile(thumbnailUri, 'base64');
                const thumbnailBase64DataUrl = `data:image/jpeg;base64,${thumbBase64}`;
                uploadedThumbnailsData.push({ uri: thumbnailBase64DataUrl, snapshot: item.formDataSnapshot });

                // Phase 1: 0-90% 진행도 (저장 단계)
                setUploadProgress(Math.round((index / totalCount) * 90));
            }
            
            // Phase 2: 서버에 전송 (90-100%)
            setUploadProgress(90);
            
            const resp = await fetch(API.uploadPhoto, { 
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${userObj.token}`,
                },
                body: uploadFormData, 
            });

            // Phase 2 완료 (100%)
            setUploadProgress(100);

            const data = await resp.json();
            
            if (data?.success) {
                Alert.alert('성공', `이미지가 성공적으로 전송 및 기록되었습니다.`);
            } else {
                console.error('Upload failed:', data);
                Alert.alert('업로드 실패', data?.error || '서버 응답 오류 (DB 기록 포함 실패)');
            }
            // uploadedThumbnails에 새로운 썸네일 누적 (FIFO: 10개 제한)
            setUploadedThumbnails(prev => {
                const updated = [...prev, ...uploadedThumbnailsData];
                // 10개 초과 시 가장 오래된 것부터 제거 (FIFO)
                if (updated.length > 10) {
                    const removed = updated.splice(0, updated.length - 10);
                    console.log(`🗑️ Removed ${removed.length} old thumbnails (FIFO). Current: ${updated.length}/10`);
                }
                return updated;
            });
        } catch (err) {
            console.error('Upload error:', err);
            Alert.alert('오류', '업로드 중 오류가 발생했습니다\n' + (err.message || err));
            // 에러 발생 시에도 누적 (FIFO: 10개 제한)
            setUploadedThumbnails(prev => {
                const updated = [...prev, ...uploadedThumbnailsData];
                if (updated.length > 10) {
                    const removed = updated.splice(0, updated.length - 10);
                    console.log(`🗑️ Removed ${removed.length} old thumbnails on error (FIFO). Current: ${updated.length}/10`);
                }
                return updated;
            }); 
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };
    
    // 🟢 적용 버튼 로직: 저장 후 업로드 통합 실행
    const handleApplyAndUpload = async () => {
        const hasImage = selectedImage || canvasImageUri;
        if (!hasImage) {
            Alert.alert('오류', '사진이 선택되지 않았습니다.');
            return;
        }

        const valid = await validateForm();
        if (!valid) {
            Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요');
            return;
        }
        
        try {
            // items 배열 수동으로 구성 (안정성 보장)
            const currentItems = items.length > 0 ? items : [{
                id: 'each',
                uri: (selectedImage || { uri: canvasImageUri }).uri,
                rotation: selectedImage?.rotation || currentRotation,
                formDataSnapshot: { ...formData },
            }];
            
            // 임시로 setItems 호출 (handleUpload에서 사용할 수 있도록)
            if (items.length === 0) {
                setItems(currentItems);
            }
            
            await handleUpload();
        } catch (e) {
            console.error('Apply sequence failed', e);
        }
    };
    
    // 🟢 카카오 공유 로직
    // 🟢 카카오 공유 로직 (여러 이미지 천천히 캡처 → 바로 공유)
    const handleKakaoShare = async () => {
        if (!items || items.length === 0) return Alert.alert('오류', '공유할 이미지가 없습니다.');
        
        setSaving(true);
        setUploadProgress(0);
        
        try {
            const shareUris = [];
            const totalCount = items.length;

            console.log('📸 Phase 1: Capturing all items for sharing...');
            
            // Phase 1: 모든 항목 천천히 캡처 (0-90%)
            for (let i = 0; i < totalCount; i++) {
                const item = items[i];
                const index = i + 1;

                // 진행도 표시 (0-90%)
                setUploadProgress(Math.round((i / totalCount) * 90));

                // 항목 선택 및 폼 데이터 로드
                setSelectedItemId(item.id);
                
                // 렌더링 완료 대기: 기본 200ms + requestAnimationFrame
                await new Promise(resolve => {
                    setTimeout(() => {
                        requestAnimationFrame(() => {
                            setTimeout(resolve, 200);
                        });
                    }, 200);
                });

                if (!hiResCanvasRef.current) {
                    console.warn(`Canvas ref not available for item ${index}`);
                    continue;
                }

                // 고해상도 캡처
                let compositeUri = await hiResCanvasRef.current.capture();
                
                if (!compositeUri) {
                    console.error(`Canvas capture failed for item ${index}`);
                    continue;
                }

                console.log(`✅ Captured item ${index}: ${compositeUri}`);
                shareUris.push(compositeUri);
            }

            if (shareUris.length === 0) {
                setSaving(false);
                Alert.alert('오류', '공유할 이미지를 캡처할 수 없습니다.');
                return;
            }

            // Phase 2: 공유 (90-100%)
            setUploadProgress(90);
            console.log(`📤 Phase 2: Sharing ${shareUris.length} images...`);

            // 공유 전 약간의 지연
            await new Promise(resolve => setTimeout(resolve, 300));

            setSaving(false);
            await Share.open({
                urls: shareUris,
                title: '현장 기록 공유',
                message: `${shareUris.length}개의 합성 이미지를 공유합니다.`,
                failOnCancel: false,
            });

            setUploadProgress(100);
            Alert.alert('완료', `${shareUris.length}개 이미지가 공유되었습니다.`);
            
        } catch (err) {
            setSaving(false);
            if (err.message !== 'User did not share') {
                console.error('❌ Share error:', err);
                Alert.alert('공유 오류', err.message || '공유 중 오류가 발생했습니다.');
            } else {
                console.log('📭 User cancelled share');
            }
        } finally {
            setSaving(false);
            setUploadProgress(0);
        }
    };
    if (sharedLogic.loading || !user) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={styles.colorPrimary} />
            </View>
        );
    }

    // --- 렌더링 ---

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={styles.colorPrimary} />

            <ScrollView style={styles.content}>
                {/* 1. 양식 선택 */}
                <Text style={styles.sectionTitle}>입력 양식 선택</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ minHeight: 56, maxHeight: 72, marginBottom: 12 }}>
                    {forms.map(form => (
                        <TouchableOpacity
                            key={form._id}
                            style={[
                                styles.formButton,
                                selectedForm?._id === form._id ? styles.formButtonSelected : styles.formButtonUnselected,
                                (uploading || saving) && styles.buttonDisabled
                            ]}
                            onPress={() => handleFormSelectionAndReset(form)}
                            disabled={uploading || saving}
                        >
                            <Text style={[
                                styles.formButtonText,
                                selectedForm?._id === form._id ? styles.formButtonTextSelected : styles.formButtonTextUnselected
                            ]}>{form.formName}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* 2. 정보 입력 및 미리보기 */}
                {selectedForm && (
                    <View>
                        {/* 2.1 정보 입력 필드 */}
                        <View style={[styles.formInputContainer, (uploading || saving) && { opacity: 0.6, pointerEvents: 'none' }]}>
                            {entries.map(entry => {
                                const field = typeof entry.field === 'object' ? (entry.field.name || entry.field._id) : entry.field;
                                const type = entry.type || 'text';
                                const options = entry.options || null;
                                const isDateField = type === 'date';
                                const value = formData[field];
                                let placeholder = field;
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
                                        editable={!uploading && !saving}
                                    />
                                );
                            })}
                        </View>

                        {/* 날짜 피커 (DatePicker 컴포넌트) */}
                        {sharedLogic.datePickerField && (
                            <DateTimePicker
                                value={formData[sharedLogic.datePickerField] ? new Date(formData[sharedLogic.datePickerField]) : new Date()}
                                mode="date"
                                display="default"
                                onChange={sharedLogic.onDateChange}
                            />
                        )}
                        
                        {/* 2.2 액션 버튼 (최소화) */}
                        <View style={styles.compactButtonRow}>
                            {/* 촬영 버튼 */}
                            <TouchableOpacity 
                                style={[styles.compactButton, (uploading || saving) && styles.buttonDisabled]} 
                                onPress={takePicture} 
                                disabled={uploading || saving}
                            >
                                <Text style={styles.compactButtonText}>촬영</Text>
                            </TouchableOpacity>
                            {/* 앨범 버튼 */}
                            <TouchableOpacity 
                                style={[styles.compactButton, (uploading || saving) && styles.buttonDisabled]} 
                                onPress={pickImage} 
                                disabled={uploading || saving}
                            >
                                <Text style={styles.compactButtonText}>앨범</Text>
                            </TouchableOpacity>
                            {/* 회전 버튼 */}
                             <TouchableOpacity 
                                style={[styles.compactButton, { backgroundColor: styles.colorSecondary }, (uploading || saving || (!selectedImage && !canvasImageUri)) && styles.buttonDisabled]} 
                                onPress={rotateImage}
                                disabled={uploading || saving || (!selectedImage && !canvasImageUri)}
                            >
                                <Text style={styles.compactButtonText}>회전</Text>
                            </TouchableOpacity>
                             {/* 공유 버튼 */}
                            <TouchableOpacity
                                style={[styles.compactButton, styles.kakaoBtn, ((!selectedImage && !canvasImageUri) || uploading || saving) && styles.buttonDisabled]}
                                onPress={handleKakaoShare}
                                disabled={(!selectedImage && !canvasImageUri) || uploading || saving}
                            >
                                <Text style={[styles.compactButtonText, { color: styles.colorWhite }]}>공유</Text>
                            </TouchableOpacity>

                            {/* 저장 버튼 */}
                            {/* <TouchableOpacity
                                style={[styles.compactButton, styles.saveBtn, saving && styles.buttonDisabled]}
                                onPress={saveToPhone}
                                disabled={saving || uploading || (!selectedImage && !canvasImageUri)}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color={styles.colorWhite} />
                                ) : (
                                    <Text style={styles.compactButtonText}>💾✔</Text>
                                )}
                            </TouchableOpacity> */}
                            {/* 적용 및 업로드 버튼 */}
                             {/* 2.4 메인 '저장 및 업로드' 버튼 */}
                        <TouchableOpacity
                            style={[
                                styles.mainActionButton,
                                (items.length === 0 || uploading || saving) && styles.buttonDisabled
                            ]}
                            onPress={handleApplyAndUpload}
                            disabled={!selectedImage && !canvasImageUri || uploading || saving}
                        >
                            <Text style={styles.mainButtonText}>
                                {uploading || saving ? `저장+업로드 중 (${uploadProgress}%)` : '전송'}
                            </Text>
                        </TouchableOpacity>
                        </View>
                        
                        {/* 2.3 미리보기 (벡터 스케일링 기반) */}
                        {selectedImage || canvasImageUri ? (
                            <>
                            {/* ImageOverlay 컴포넌트: React View 기반 미리보기 */}
                            <View style={{
                                width: previewDims.width,
                                height: previewDims.height,
                                alignSelf: 'center',
                                marginVertical: 12,
                                borderWidth: 1,
                                borderColor: styles.colorSecondary,
                                borderRadius: 8,
                                overflow: 'hidden',
                                elevation: 5,
                            }}>
                                <ImageOverlay
                                    selectedImage={selectedImage || { uri: canvasImageUri, rotation: currentRotation }}
                                    rotation={currentRotation}
                                    formData={formData}
                                    tableEntries={entries}
                                    tableConfig={dynamicTableConfigPreview}
                                    previewDims={previewDims}
                                />
                            </View>
                            
                            {/* 🚨 고해상도 캔버스 영역 (숨김, 캡처 전용) */}
                            <View
                                style={{
                                    width: hiResDims.width, height: hiResDims.height,
                                    position: 'absolute', left: -9999, top: -9999, 
                                    opacity: 0, zIndex: -9999,
                                }}
                                pointerEvents="none"
                            >
                                <ImageOverlay
                                    ref={hiResCanvasRef}
                                    selectedImage={selectedImage || { uri: canvasImageUri, rotation: currentRotation }}
                                    rotation={currentRotation}
                                    canvasDims={hiResDims} 
                                    tableEntries={entries}
                                    tableConfig={dynamicTableConfigHiRes}
                                    formData={formData}
                                />

                            </View>
                            </>
                        ) : (
                            <View style={{ height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e2e8f0', borderRadius: 8, marginVertical: 12 }}>
                                <Text style={{ color: styles.colorTextLight }}>사진을 촬영하거나 앨범에서 불러와주세요.</Text>
                            </View>
                        )}

                       
                        
                        {/* 2.5 썸네일 리스트 */}
                        {items && items.length > 0 && (
                            <View style={(uploading || saving) && { opacity: 0.6, pointerEvents: 'none' }}>
                                <ThumbnailList 
                                    items={items} 
                                    onSelect={uploading || saving ? null : onSelectThumbnail} 
                                    selectedItemId={selectedItemId}
                                />
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* 업로드 진행 UI */}
            {(uploading || saving) && (
                <View style={{ width: '100%', padding: 16, backgroundColor: styles.colorWhite, borderTopWidth: 1, borderTopColor: '#e2e8f0' }}>
                    <View style={{ marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: styles.colorTextDark }}>
                                {saving ? '저장 중...' : '업로드 중...'}
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: styles.colorPrimary }}>
                                {uploadProgress}%
                            </Text>
                        </View>
                        <View style={{ width: '100%', height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                            <View style={{ width: `${uploadProgress}%`, height: '100%', backgroundColor: styles.colorPrimary, borderRadius: 3 }} />
                        </View>
                    </View>
                    <Text style={{ fontSize: 12, color: styles.colorTextLight }}>
                        {saving ? '이미지 저장 중...' : '서버로 전송 중...'}
                    </Text>
                </View>
            )}
        </View>
    );
};


export default UploadEachScreen;