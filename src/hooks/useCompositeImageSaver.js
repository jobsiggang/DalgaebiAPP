// src/hooks/useCompositeImageSaver.js
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { canvasConfig } from '../config/compositeConfig';

/**
 * 공통 합성이미지 저장 훅/함수
 * @param {object} params - { compositeUri, originalUri, img, index, hiResCanvasRef, formData }
 */
export async function saveCompositeImageToPhone({ compositeUri, originalUri, img, index, hiResCanvasRef, formData }) {
    let hiResUri = compositeUri;
    if (hiResCanvasRef?.current && hiResCanvasRef.current.capture) {
        hiResUri = await hiResCanvasRef.current.capture();
    }
    
    // 원본 저장 (사진 촬영/선택 시)
    if (originalUri) {
        // 원본은 Camera 폴더에 저장
        const origDir = Platform.OS === 'android' 
            ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera` 
            : `${RNFS.PicturesDirectoryPath}/Camera`;
        const origExists = await RNFS.exists(origDir);
        if (!origExists) { await RNFS.mkdir(origDir); }
        
        const origFileName = `ORIGINAL_${Date.now()}.jpg`;
        const origPath = `${origDir}/${origFileName}`;
        await RNFS.copyFile(originalUri, origPath);
        if (Platform.OS === 'android' && RNFS.scanFile) { 
            try { await RNFS.scanFile(origPath); } catch (e) { /* ignore */ } 
        }
    } else if (canvasConfig.saveOriginalPhoto && img?.uri && img?.fileName) {
        // Fallback: img에서 원본 저장 (이전 호환성)
        const origDir = Platform.OS === 'android' 
            ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera` 
            : `${RNFS.PicturesDirectoryPath}/Camera`;
        const origExists = await RNFS.exists(origDir);
        if (!origExists) { await RNFS.mkdir(origDir); }
        const origPath = `${origDir}/ORIGINAL_${img.fileName}`;
        await RNFS.copyFile(img.uri, origPath);
        if (Platform.OS === 'android' && RNFS.scanFile) { 
            try { await RNFS.scanFile(origPath); } catch (e) { /* ignore */ } 
        }
    }
    
    // 🚨 합성사진 고품질 저장 (갤러리용)
    // 업로드 파일이름과 동일한 형식 사용 (formName_index_timestamp.jpg)
    const fileName = `${formData?.formName || 'photo'}_${index}_${Date.now()}.jpg`;
    const destDir = Platform.OS === 'android' 
        ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/${canvasConfig.saveFolder}` 
        : `${RNFS.PicturesDirectoryPath}/${canvasConfig.saveFolder}`;
    const dirExists = await RNFS.exists(destDir);
    if (!dirExists) { await RNFS.mkdir(destDir); }
    
    const destPath = `${destDir}/${fileName}`;
    
    // ViewShot 캡처 결과가 tmpfile인 경우 직접 복사, 아니면 URI로 복사
    // 🚨 고품질 유지를 위해 직접 파일 복사 (재인코딩 방지)
    try {
        await RNFS.copyFile(hiResUri, destPath);
    } catch (err) {
        console.warn('High quality copy failed, fallback to standard copy:', err);
        // Fallback: 재인코딩 위험 있지만 호환성 보장
        await RNFS.copyFile(compositeUri, destPath);
    }
    
    if (Platform.OS === 'android' && RNFS.scanFile) { 
        try { await RNFS.scanFile(destPath); } catch (e) { /* ignore */ } 
    }
}
