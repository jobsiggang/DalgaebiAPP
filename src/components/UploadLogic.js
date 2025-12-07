// src/hooks/useCompositeImageSaver.js

import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { canvasConfig } from '../config/compositeConfig';
import { v4 as uuidv4 } from 'uuid'; // 💡 UUID 라이브러리 가정 (설치 필요: npm install uuid)

/**
 * 공통 합성이미지 저장 훅/함수
 * @param {object} params - { compositeUri, img, formData }
 */
export async function saveCompositeImageToPhone({ compositeUri, img, formData }) {
    let hiResUri = compositeUri;
    
    // --- 1. 원본 이미지 저장 (옵션 체크) ---
    // 원본 저장 로직은 변경 없이 유지
    if (canvasConfig.saveOriginalPhoto && img?.uri && img?.fileName) {
        // 원본은 Camera 폴더에 저장
        const origDir = Platform.OS === 'android' ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera` : `${RNFS.PicturesDirectoryPath}/Camera`;
        const origExists = await RNFS.exists(origDir);
        if (!origExists) { await RNFS.mkdir(origDir); }
        const origPath = `${origDir}/ORIGINAL_${img.fileName}`;
        await RNFS.copyFile(img.uri, origPath);
        if (Platform.OS === 'android' && RNFS.scanFile) { try { await RNFS.scanFile(origPath); } catch (e) { /* ignore */ } }
    }

    // --- 2. 편집 사진 (합성 이미지) 저장 ---
    
    // 💡 NEW: UUID 기반 고유 파일명 생성
    const uniqueId = uuidv4();
    const fileName = `편집사진_${formData?.['이름'] || '기록'}_${uniqueId}.jpg`;
    
    // 저장 경로 설정
    const destDir = Platform.OS === 'android' 
        ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/${canvasConfig.saveFolder}` 
        : `${RNFS.PicturesDirectoryPath}/${canvasConfig.saveFolder}`;
        
    // 디렉토리 존재 여부 확인 및 생성
    const dirExists = await RNFS.exists(destDir);
    if (!dirExists) { await RNFS.mkdir(destDir); }
    
    // 파일 복사 및 저장
    const destPath = `${destDir}/${fileName}`;
    await RNFS.copyFile(hiResUri, destPath);

    // 안드로이드 미디어 스캔
    if (Platform.OS === 'android' && RNFS.scanFile) { 
        try { 
            await RNFS.scanFile(destPath); 
        } catch (e) { 
            /* ignore */ 
        } 
    }
}