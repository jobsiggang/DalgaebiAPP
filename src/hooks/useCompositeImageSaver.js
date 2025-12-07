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
    
    // 합성사진은 dalgaebi 폴더에 저장
    // 업로드 파일이름과 동일한 형식 사용 (formName_index_timestamp.jpg)
    const fileName = `${formData?.formName || 'photo'}_${index}_${Date.now()}.jpg`;
    const destDir = Platform.OS === 'android' 
        ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/${canvasConfig.saveFolder}` 
        : `${RNFS.PicturesDirectoryPath}/${canvasConfig.saveFolder}`;
    const dirExists = await RNFS.exists(destDir);
    if (!dirExists) { await RNFS.mkdir(destDir); }
    const destPath = `${destDir}/${fileName}`;
    await RNFS.copyFile(hiResUri, destPath);
    if (Platform.OS === 'android' && RNFS.scanFile) { 
        try { await RNFS.scanFile(destPath); } catch (e) { /* ignore */ } 
    }
}
