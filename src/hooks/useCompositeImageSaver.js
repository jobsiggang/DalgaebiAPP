// src/hooks/useCompositeImageSaver.js
import RNFS from 'react-native-fs';
import { Platform, Alert } from 'react-native';
import { canvasConfig } from '../config/compositeConfig';

// ✅ iOS 시뮬레이터 감지 (DocumentDirectory 사용 여부 판단)
const isIOSSimulator = async () => {
    if (Platform.OS !== 'ios') return false;
    try {
        // 시뮬레이터: PicturesDirectory 접근 불가, DocumentDirectory만 가능
        const result = await RNFS.readDir(RNFS.PicturesDirectoryPath);
        return false; // 실제 기기
    } catch {
        return true; // 시뮬레이터
    }
};

// Export for use in other components
export { isIOSSimulator };

/**
 * 공통 합성이미지 저장 훅/함수
 * @param {object} params - { compositeUri, originalUri, img, index, hiResCanvasRef, formData }
 */
export async function saveCompositeImageToPhone({ compositeUri, originalUri, img, index, hiResCanvasRef, formData }) {
    let hiResUri = compositeUri;
    if (hiResCanvasRef?.current && hiResCanvasRef.current.capture) {
        hiResUri = await hiResCanvasRef.current.capture();
    }
    
    // ✅ iOS 시뮬레이터 여부 감지
    const isSimulator = Platform.OS === 'ios' && await isIOSSimulator();
    console.log(`📱 실행 환경: ${isSimulator ? 'iOS 시뮬레이터' : Platform.OS === 'ios' ? '실제 iOS 기기' : 'Android'}`);
    
    // 원본 저장 (사진 촬영/선택 시)
    if (originalUri) {
        try {
            let origDir;
            if (isSimulator) {
                // iOS 시뮬레이터: 문서 디렉토리 사용 (읽기 전용 이슈 회피)
                origDir = `${RNFS.DocumentDirectoryPath}/Camera`;
            } else {
                // Android & 실제 iOS: 사진 폴더 사용
                origDir = Platform.OS === 'android' 
                    ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera` 
                    : `${RNFS.PicturesDirectoryPath}/Camera`;
            }
            
            const origExists = await RNFS.exists(origDir);
            if (!origExists) { await RNFS.mkdir(origDir); }
            
            const origFileName = `ORIGINAL_${Date.now()}.jpg`;
            const origPath = `${origDir}/${origFileName}`;
            await RNFS.copyFile(originalUri, origPath);
            console.log('✅ 원본 이미지 저장 완료:', origPath);
            
            if (Platform.OS === 'android' && RNFS.scanFile) { 
                try { await RNFS.scanFile(origPath); } catch (e) { /* ignore */ } 
            }
        } catch (err) {
            console.warn('⚠️ 원본 이미지 저장 실패 (무시):', err.message);
            // 원본 저장 실패는 무시하고 계속 진행
        }
    } else if (canvasConfig.saveOriginalPhoto && img?.uri && img?.fileName) {
        try {
            let origDir;
            if (isSimulator) {
                origDir = `${RNFS.DocumentDirectoryPath}/Camera`;
            } else {
                origDir = Platform.OS === 'android' 
                    ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/Camera` 
                    : `${RNFS.PicturesDirectoryPath}/Camera`;
            }
            const origExists = await RNFS.exists(origDir);
            if (!origExists) { await RNFS.mkdir(origDir); }
            const origPath = `${origDir}/ORIGINAL_${img.fileName}`;
            await RNFS.copyFile(img.uri, origPath);
            console.log('✅ 원본 이미지 저장 완료:', origPath);
            
            if (Platform.OS === 'android' && RNFS.scanFile) { 
                try { await RNFS.scanFile(origPath); } catch (e) { /* ignore */ } 
            }
        } catch (err) {
            console.warn('⚠️ 원본 이미지 저장 실패 (무시):', err.message);
        }
    }
    
    // 🚨 합성사진 고품질 저장 (갤러리용)
    // 업로드 파일이름과 동일한 형식 사용 (formName_index_timestamp.jpg)
    const fileName = `${formData?.formName || 'photo'}_${index}_${Date.now()}.jpg`;
    let destDir;
    if (isSimulator) {
        // iOS 시뮬레이터: 문서 디렉토리 사용
        destDir = `${RNFS.DocumentDirectoryPath}/${canvasConfig.saveFolder || 'CompositePhotos'}`;
    } else {
        // Android & 실제 iOS: 사진 폴더 사용
        destDir = Platform.OS === 'android' 
            ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/${canvasConfig.saveFolder}` 
            : `${RNFS.PicturesDirectoryPath}/${canvasConfig.saveFolder}`;
    }
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
