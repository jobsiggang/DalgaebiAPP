// src/screens/UploadMultiScreen.js

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
import Share from 'react-native-share';
import ImageResizer from 'react-native-image-resizer';
import { useFocusEffect } from '@react-navigation/native';
import FormField from '../components/FormField.js';

import ImageOverlay from '../components/ImageOverlay.js';
import { useSharedUploadLogic } from '../hooks/useSharedUploadLogic';
import ThumbnailList from '../components/ThumbnailList';
import API from '../config/api';
import { canvasConfig } from '../config/compositeConfig'; 
import styles from './styles/UploadCommonStyles.js';


const UploadMultiScreen = ({ navigation, route }) => {
    const sharedLogic = useSharedUploadLogic(navigation, route, 'multi'); 
    const hiResCanvasRef = useRef(null);
    
    const [items, setItems] = useState([]); 
    const [selectedItemId, setSelectedItemId] = useState(null); 
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadedThumbnails, setUploadedThumbnails] = useState([]); 

    const selectedItem = items.find(item => item.id === selectedItemId);
    const currentRotation = selectedItem?.rotation || 0; 
    
    const { 
        user, forms, selectedForm, formData, validateForm, 
        updateField, onDateChange, setDatePickerField, validationErrors, 
        setFormData, handleSelectForm, configVersion,
        previewDims, entries, tableConfigPreview, tableConfigHiRes, hiResDims, calculateTableConfig
    } = sharedLogic;    // 🚀 모드 설정
    useFocusEffect(
        React.useCallback(() => {
            AsyncStorage.setItem('uploadMode', 'multi');
        }, [])
    );

    // 🚨 실시간 tableConfig 계산 (formData 변경 시 즉시 반영)
    const dynamicTableConfigPreview = useMemo(() => {
        return calculateTableConfig(previewDims);
    }, [calculateTableConfig, previewDims, formData, configVersion]);

    const dynamicTableConfigHiRes = useMemo(() => {
        return calculateTableConfig(hiResDims);
    }, [calculateTableConfig, hiResDims, formData, configVersion]);

    // 🚨 회전에 따른 동적 캔버스 크기 계산
    const rotatedCanvasDims = useMemo(() => {
        const rotation = currentRotation % 360;
        // 90도 또는 270도 회전: 가로세로 스왑
        if (rotation === 90 || rotation === 270) {
            return {
                width: hiResDims.height,
                height: hiResDims.width,
            };
        }
        return hiResDims;
    }, [currentRotation, hiResDims]);
    
    // 💡 [핵심 - 자동 저장(Auto-Save) 로직]
    useEffect(() => {
        if (!selectedItemId) return;
        setItems(prevItems => prevItems.map(item => {
            if (item.id === selectedItemId) {
                return {
                    ...item,
                    formDataSnapshot: { ...formData }, // 현재 전역 formData 스냅샷 저장
                    rotation: currentRotation, // 현재 회전 값 저장
                };
            }
            return item;
        }));
    }, [selectedItemId, formData, currentRotation]); 

    // 💡 썸네일 선택 처리 함수: 상태 기록 후, 선택된 아이템의 스냅샷을 전역 formData에 로드
    const onSelectItem = useCallback((itemOrItemId) => {
        // itemOrItemId가 전체 item 객체일 수도, id만 올 수도 있음 (ThumbnailList에서 전체 객체 전달)
        const item = typeof itemOrItemId === 'object' ? itemOrItemId : items.find(i => i.id === itemOrItemId);
        
        if (!item || selectedItemId === item.id) return; 

        // 새로 선택된 아이템의 상태를 로드
        setFormData(item.formDataSnapshot || {}); 
        setSelectedItemId(item.id);
    }, [selectedItemId, items, setFormData]);    // --- 이미지 선택/촬영 로직 ---

    const handleImagePickerResponse = useCallback((response) => {
        if (!response.didCancel && !response.errorCode && response.assets) {
            const assetsWithSnapshot = (Array.isArray(response.assets) ? response.assets : [response.assets])
                .map(asset => ({
                    id: Date.now() + Math.random(),
                    uri: asset.uri,
                    rotation: 0,
                    width: asset.width,
                    height: asset.height,
                    formDataSnapshot: { ...formData },
                }));

            // 🔒 10개 제한 확인
            const remainingSlots = 10 - items.length;
            if (remainingSlots <= 0) {
                Alert.alert('경고', '최대 10개 이미지까지만 추가 가능합니다.');
                return;
            }

            const assetsToAdd = assetsWithSnapshot.slice(0, remainingSlots);
            const skippedCount = assetsWithSnapshot.length - assetsToAdd.length;

            if (skippedCount > 0) {
                Alert.alert('안내', `${skippedCount}개 이미지는 제한으로 인해 제외되었습니다. (현재 ${items.length}/${10})`);
            }

            // 원본 이미지 즉시 앨범 저장
            assetsToAdd.forEach(async (item, idx) => {
                try {
                    await saveCompositeImageToPhone({ compositeUri: item.uri, img: item, index: idx + 1, formData });
                } catch (err) {
                    Alert.alert('오류', '원본 이미지 저장 실패: ' + (err.message || err));
                }
            });

            setItems(prevItems => [...prevItems, ...assetsToAdd]);
            if (assetsToAdd.length > 0) {
                setSelectedItemId(assetsToAdd[0].id);
            }
        }
    }, [formData, items.length]);


    const takePicture = useCallback(async () => {
        if (items.length >= 10) {
            Alert.alert('경고', '최대 10개 이미지까지만 추가 가능합니다. (현재 10/10)');
            return;
        }
        const valid = await validateForm();
        if (!valid) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요');
        launchCamera({ mediaType: 'photo', quality: 0.8, saveToPhotos: false, selectionLimit: 1 }, handleImagePickerResponse);
    }, [validateForm, handleImagePickerResponse, items.length]);

    const pickImage = useCallback(async () => {
        if (items.length >= 10) {
            Alert.alert('경고', '최대 10개 이미지까지만 추가 가능합니다. (현재 10/10)');
            return;
        }
        const valid = await validateForm();
        if (!valid) return Alert.alert('입력 오류', '모든 필수 항목을 입력해주세요');
        launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 10 }, handleImagePickerResponse);
    }, [validateForm, handleImagePickerResponse, items.length]);


    // 회전 로직 (선택된 아이템의 rotation 속성만 업데이트)
    const rotateImage = useCallback(() => {
        if (!selectedItemId) return;

        setItems(prevItems => prevItems.map(item => {
            if (item.id === selectedItemId) {
                const newRotation = (item.rotation || 0) + 90;
                return {
                    ...item,
                    rotation: newRotation % 360
                };
            }
            return item;
        }));
    }, [selectedItemId]);

    const removeImage = useCallback(async id => {
        const newItems = items.filter(item => item.id !== id);
        setItems(newItems);
        
        if (selectedItemId === id) {
            setSelectedItemId(newItems.length > 0 ? newItems[0].id : null);
            if (newItems.length > 0) {
                setFormData(newItems[0].formDataSnapshot || {});
            }
        } else if (newItems.length > 0 && !newItems.find(item => item.id === selectedItemId)) {
            setSelectedItemId(newItems[0].id);
            setFormData(newItems[0].formDataSnapshot || {});
        }
    }, [items, selectedItemId, setFormData]);

    const handleFormSelectionAndReset = useCallback((form) => {
        setItems([]); 
        setSelectedItemId(null);
        setFormData({}); 
        handleSelectForm(form); 
    }, [setItems, setSelectedItemId, setFormData, handleSelectForm]);


    // --- 저장 및 업로드 로직 (멀티스크린 고유) ---

    const handleUpload = async () => {
        if (!selectedForm) return Alert.alert('오류', '양식을 선택해주세요');
        if (items.length === 0) return Alert.alert('오류', '사진을 추가해주세요');
        
        setUploading(true);
        setUploadProgress(0);

        const initialSelectedItemId = selectedItemId;
        const initialFormData = { ...formData };
        const BATCH_SIZE = 3; // 3개씩 묶어서 처리
        
        try {
            const userData = await AsyncStorage.getItem('user');
            const userObj = userData ? JSON.parse(userData) : null;
            if (!userObj?.token) {
                Alert.alert('오류', '로그인이 필요합니다.');
                navigation.replace('Login');
                return;
            }

            const totalCount = items.length;
            const uploadedThumbnailsData = [];
            const allBatches = []; // 모든 배치 데이터 저장

            // Phase 1: 모든 이미지를 배치로 나누어 캡처 및 저장
            console.log('📸 Phase 1: Capturing and saving batches to phone...');
            for (let batchStart = 0; batchStart < totalCount; batchStart += BATCH_SIZE) {
                const batchEnd = Math.min(batchStart + BATCH_SIZE, totalCount);
                const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
                const batchItems = items.slice(batchStart, batchEnd);
                const batchData = [];

                console.log(`🎬 Capturing Batch ${batchNum}: Items ${batchStart + 1} - ${batchEnd}...`);

                // 배치의 각 항목 캡처 및 저장
                for (let i = 0; i < batchItems.length; i++) {
                    const item = batchItems[i];
                    const globalIndex = batchStart + i;
                    const index = globalIndex + 1;

                    // Phase 1: 0-90% (저장 단계)
                    setUploadProgress(Math.round((globalIndex / totalCount) * 90));

                    setSelectedItemId(item.id);
                    setFormData(item.formDataSnapshot);

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

                    let compositeUri = await hiResCanvasRef.current.capture();

                    if (!compositeUri) {
                        console.error(`Canvas capture failed for item ${index}`);
                        Alert.alert('오류', `${index}번째 이미지 캡처 실패`);
                        continue;
                    }

                    await saveCompositeImageToPhone({
                        compositeUri,
                        img: item,
                        index,
                        formData: item.formDataSnapshot
                    });
                    console.log(`✅ Saved item ${index} to phone`);

                    const thumbWidth = 500;
                    const thumbHeight = Math.round(thumbWidth * (hiResDims.height / hiResDims.width));
                    let thumb;
                    try {
                        thumb = await ImageResizer.createResizedImage(compositeUri, thumbWidth, thumbHeight, 'JPEG', 80);
                    } catch (err) {
                        console.error(`Thumbnail creation failed for item ${index}:`, err);
                        Alert.alert('오류', `${index}번째 이미지 썸네일 생성 실패`);
                        continue;
                    }

                    if (!thumb || !thumb.uri) {
                        console.error(`Thumbnail URI invalid for item ${index}`);
                        continue;
                    }

                    const thumbnailUri = thumb.uri;
                    const filename = `${selectedForm.formName}_${index}_${Date.now()}.jpg`;

                    const thumbBase64 = await RNFS.readFile(thumbnailUri, 'base64');
                    const thumbnailBase64DataUrl = `data:image/jpeg;base64,${thumbBase64}`;

                    uploadedThumbnailsData.push({
                        uri: thumbnailBase64DataUrl,
                        formDataSnapshot: item.formDataSnapshot
                    });

                    const saveDir = Platform.OS === 'android'
                        ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/${canvasConfig.saveFolder}`
                        : `${RNFS.PicturesDirectoryPath}/${canvasConfig.saveFolder}`;

                    const dirExists = await RNFS.exists(saveDir);
                    if (!dirExists) await RNFS.mkdir(saveDir);

                    const compositePath = `${saveDir}/${filename}`;
                    const compositeBase64 = await RNFS.readFile(compositeUri, 'base64');
                    await RNFS.writeFile(compositePath, compositeBase64, 'base64');

                    const thumbPath = `${saveDir}/thumb_${filename}`;
                    await RNFS.writeFile(thumbPath, thumbBase64, 'base64');

                    // 저장된 파일 정보 수집
                    const fileUri = Platform.OS === 'android'
                        ? `file://${compositePath}`
                        : compositePath;
                    const thumbUri = Platform.OS === 'android'
                        ? `file://${thumbPath}`
                        : thumbPath;

                    batchData.push({
                        index,
                        filename,
                        fileUri,
                        thumbUri,
                        formDataSnapshot: item.formDataSnapshot,
                    });
                }

                allBatches.push(batchData);
            }

            // Phase 2: 배치로 업로드 (90-100%)
            console.log(`📤 Phase 2: Uploading batches...`);
            for (let batchIdx = 0; batchIdx < allBatches.length; batchIdx++) {
                const batch = allBatches[batchIdx];
                const batchNum = batchIdx + 1;

                console.log(`📦 Uploading Batch ${batchNum}: Items ${batch[0].index} - ${batch[batch.length - 1].index}`);

                const uploadFormData = new FormData();
                uploadFormData.append('formId', selectedForm._id);
                uploadFormData.append('formName', selectedForm.formName);
                uploadFormData.append('totalCount', String(totalCount));
                uploadFormData.append('batchSize', String(batch.length));

                // 배치의 모든 항목을 FormData에 추가
                for (let j = 0; j < batch.length; j++) {
                    const item = batch[j];
                    uploadFormData.append(`file_${j}`, {
                        uri: item.fileUri,
                        type: 'image/jpeg',
                        name: item.filename,
                    });
                    uploadFormData.append(`thumbnail_${j}`, {
                        uri: item.thumbUri,
                        type: 'image/jpeg',
                        name: `thumb_${item.filename}`,
                    });
                    uploadFormData.append(`fieldData_${j}`, JSON.stringify(item.formDataSnapshot));
                }

                try {
                    const resp = await fetch(API.uploadPhoto, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${userObj.token}`,
                        },
                        body: uploadFormData,
                    });

                    const text = await resp.text();
                    let data;
                    try {
                        data = JSON.parse(text);
                    } catch (e) {
                        console.error(`JSON Parse error for batch ${batchNum}:`, text);
                        throw new Error(`파싱 오류: ${text.substring(0, 50)}`);
                    }

                    if (!data?.success) {
                        console.error(`Batch upload failed for batch ${batchNum}:`, data);
                        throw new Error(data?.error || '서버 오류');
                    }

                    console.log(`✅ Batch ${batchNum} uploaded (${batch.length} items)`);

                    // Phase 2: 90-100% (전송 단계)
                    const uploadedCount = batchIdx + 1;
                    setUploadProgress(90 + Math.round((uploadedCount / allBatches.length) * 10));
                } catch (uploadErr) {
                    console.error(`Batch upload error for batch ${batchNum}:`, uploadErr);
                    Alert.alert('업로드 실패', `배치 ${batchNum} 업로드 실패: ${uploadErr.message}`);
                    throw uploadErr;
                }
            }

            setUploadProgress(100);
            console.log('✅ All batches uploaded');

            Alert.alert('성공', `${totalCount}개 이미지가 휴대폰에 저장되고 성공적으로 전송되었습니다.`);
            setUploadedThumbnails(uploadedThumbnailsData);

        } catch (err) {
            console.error('Upload error:', err);
            Alert.alert('오류', '업로드 중 오류가 발생했습니다\n' + (err.message || err));
        } finally {
            setUploading(false);
            setUploadProgress(0);

            if (initialSelectedItemId) {
                const originalItem = items.find(item => item.id === initialSelectedItemId);
                if (originalItem) setFormData(originalItem.formDataSnapshot);
            }
        }
    };    // 🟢 카카오 공유 로직 (여러 이미지 천천히 캡처 → 바로 공유)
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
                setFormData(item.formDataSnapshot || {});

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
        } catch (e) {
            setSaving(false);
            if (e.message !== 'User did not share') {
                console.error('❌ Share error:', e);
                Alert.alert('공유 오류', e.message || '공유 중 오류가 발생했습니다.');
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

                        {/* 날짜 피커 */}
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
                                style={[styles.compactButton, (uploading || saving || items.length >= 10) && styles.buttonDisabled]} 
                                onPress={takePicture} 
                                disabled={uploading || saving || items.length >= 10}
                            >
                                <Text style={styles.compactButtonText}>촬영</Text>
                            </TouchableOpacity>
                            {/* 앨범 버튼 */}
                            <TouchableOpacity 
                                style={[styles.compactButton, (uploading || saving || items.length >= 10) && styles.buttonDisabled]} 
                                onPress={pickImage} 
                                disabled={uploading || saving || items.length >= 10}
                            >
                                <Text style={styles.compactButtonText}>앨범</Text>
                            </TouchableOpacity>
                            
                            {/* 회전 버튼 */}
                             <TouchableOpacity 
                                style={[styles.compactButton, { backgroundColor: styles.colorSecondary }, (uploading || saving || !selectedItem) && styles.buttonDisabled]} 
                                onPress={rotateImage}
                                disabled={uploading || saving || !selectedItem}
                            >
                                <Text style={styles.compactButtonText}>회전</Text>
                            </TouchableOpacity>
                                                    

                             {/* 공유 버튼 */}
                            <TouchableOpacity
                                style={[styles.compactButton, styles.kakaoBtn, ((!selectedItem) || uploading || saving) && styles.buttonDisabled]}
                                onPress={handleKakaoShare}
                                disabled={!selectedItem || uploading || saving}
                            >
                                <Text style={[styles.compactButtonText, { color: styles.colorWhite }]}>공유</Text>
                            </TouchableOpacity>
                            {/* 메인 '업로드' 버튼 */}
                        <TouchableOpacity
                            style={[
                                styles.mainActionButton,
                                (items.length === 0 || uploading || saving) && styles.buttonDisabled
                            ]}
                            onPress={handleUpload}
                            disabled={items.length === 0 || uploading || saving}
                        >
                            <Text style={styles.mainButtonText}>
                                {uploading ? `전체 ${items.length}개 이미지 전송 중 (${uploadProgress}%)` : `☁️ 전체 ${items.length}개 전송`}
                            </Text>
                        </TouchableOpacity>
                        </View>
                                               

                        
                        {/* 2.3 미리보기 (벡터 스케일링 기반) */}
                        {selectedItem ? (
                            <>
                            {/* ImageOverlay 컴포넌트: 미리보기 */}
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
                                    selectedImage={selectedItem}
                                    rotation={currentRotation}
                                    canvasDims={previewDims} 
                                    tableEntries={entries}
                                    tableConfig={dynamicTableConfigPreview}
                                    formData={formData}
                                />
                            </View>
                            
                            {/* 🚨 고해상도 캔버스 영역 (숨김, 캡처 전용) */}
                           
                            {/* 🚨 고해상도 캔버스 영역 (숨김, 캡처 전용) */}
                            <View
                                style={{
                                    width: rotatedCanvasDims.width, height: rotatedCanvasDims.height,
                                    position: 'absolute', left: -9999, top: -9999, 
                                    opacity: 0, zIndex: -9999,
                                }}
                                pointerEvents="none"
                            >
                                <ImageOverlay
                                    ref={hiResCanvasRef}
                                    selectedImage={selectedItem}
                                    rotation={currentRotation}
                                    canvasDims={rotatedCanvasDims} 
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
                        {items.length > 0 && (
                            <View style={(uploading || saving) && { opacity: 0.6, pointerEvents: 'none' }}>
                                <ThumbnailList 
                                    items={items} 
                                    selectedItemId={selectedItemId} 
                                    onSelect={uploading || saving ? null : onSelectItem} 
                                    onRemove={uploading || saving ? null : removeImage}
                                />
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* 업로드 진행 UI (화면 하단) */}
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
                        {saving ? '이미지 저장 중...' : `${items.length}개 중 ${Math.ceil(uploadProgress * items.length / 100)}개 전송 중...`}
                    </Text>
                </View>
            )}
        </View>
    );
};

export default UploadMultiScreen;