// src/hooks/useCompositeImageSaver.js
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { canvasConfig } from '../config/compositeConfig';

/**
 * 공통 합성이미지 저장 훅/함수
 * @param {object} params - { compositeUri, img, index, hiResCanvasRef }
 */
export async function saveCompositeImageToPhone({ compositeUri, img, index, hiResCanvasRef }) {
    let hiResUri = compositeUri;
    if (hiResCanvasRef?.current && hiResCanvasRef.current.capture) {
        hiResUri = await hiResCanvasRef.current.capture();
    }
    // 원본 저장 (사진 촬영 시만, 옵션 체크)
    if (canvasConfig.saveOriginalPhoto && img?.uri && img?.fileName) {
        const origDir = Platform.OS === 'android' ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/${canvasConfig.saveFolder}` : `${RNFS.PicturesDirectoryPath}/${canvasConfig.saveFolder}`;
        const origExists = await RNFS.exists(origDir);
        if (!origExists) { await RNFS.mkdir(origDir); }
        const origPath = `${origDir}/ORIGINAL_${img.fileName}`;
        await RNFS.copyFile(img.uri, origPath);
    }
    // dalgaebi 폴더 저장
    const fileName = `합성이미지_${index}_${Date.now()}.jpg`;
    const destDir = Platform.OS === 'android' ? `${RNFS.ExternalStorageDirectoryPath}/DCIM/${canvasConfig.saveFolder}` : `${RNFS.PicturesDirectoryPath}/${canvasConfig.saveFolder}`;
    const dirExists = await RNFS.exists(destDir);
    if (!dirExists) { await RNFS.mkdir(destDir); }
    const destPath = `${destDir}/${fileName}`;
    await RNFS.copyFile(hiResUri, destPath);
    if (Platform.OS === 'android' && RNFS.scanFile) { try { await RNFS.scanFile(destPath); } catch (e) { /* ignore */ } }
}
