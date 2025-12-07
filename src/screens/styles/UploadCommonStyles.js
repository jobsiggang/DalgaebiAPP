import { StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

// --- 컬러 팔레트 (달개비꽃 테마) ---
const COLOR_PRIMARY = '#7162D9';    // 메인 보라색 (달개비 꽃받침)
const COLOR_SECONDARY = '#908DF2';  // 보라색 (달개비 꽃잎)
const COLOR_ACCENT = '#A3A0F2';     // 밝은 보라 (달개비 밝은 부분)
const COLOR_DARK_GREEN = '#154001'; // 진한 녹색 (달개비 줄기/잎)
const COLOR_LIGHT_GREEN = '#698C58'; // 밝은 녹색 (달개비 잎 밝은 부분)
const COLOR_BACKGROUND = '#fafaf8'; // 밝은 크림색 배경
const COLOR_TEXT_DARK = '#2d2416';  // 진한 텍스트 (진한 갈색)
const COLOR_TEXT_LIGHT = '#6b6257'; // 중간 텍스트 (연한 갈색)
const COLOR_WHITE = '#fff';
const COLOR_ERROR = '#ef4444';
const THUMB_SIZE = 80; // PhotoSelector 썸네일 크기

const styles = StyleSheet.create({
    // --- 1. 공통 및 레이아웃 ---
    colorPrimary: COLOR_PRIMARY,
    colorSecondary: COLOR_SECONDARY,
    colorAccent: COLOR_ACCENT,
    colorBackground: COLOR_BACKGROUND,
    colorTextDark: COLOR_TEXT_DARK,
    colorTextLight: COLOR_TEXT_LIGHT,
    colorWhite: COLOR_WHITE,
    colorError: COLOR_ERROR,
    
    container: {
        flex: 1,
        backgroundColor: COLOR_BACKGROUND,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: { 
        marginTop: 12, 
        fontSize: 14, 
        color: COLOR_TEXT_LIGHT 
    },
    buttonDisabled: {
        opacity: 0.5,
        backgroundColor: '#cbd5e1',
        elevation: 0,
    },

    // --- 2. 업로드 화면 공용 스타일 ---
    content: {
        paddingHorizontal: 16,
        paddingVertical: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLOR_TEXT_DARK,
        marginTop: 10,
        marginBottom: 10,
    },
    // 양식 선택 버튼 (UploadEachScreen)
    formButton: {
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 10, 
        paddingHorizontal: 18, 
        marginRight: 10, 
        borderWidth: 1, 
        borderRadius: 20, 
        elevation: 1,
    },
    formButtonSelected: {
        borderColor: COLOR_PRIMARY, 
        backgroundColor: '#ede9ff', 
        elevation: 3,
    },
    formButtonUnselected: {
        borderColor: '#dcd8e8',
        backgroundColor: COLOR_WHITE,
    },
    formButtonText: {
        fontSize: 15, 
        fontWeight: 'bold', 
    },
    formButtonTextSelected: {
        color: COLOR_PRIMARY,
    },
    formButtonTextUnselected: {
        color: COLOR_TEXT_LIGHT,
    },
    // 입력 필드 컨테이너 (UploadEachScreen)
    formInputContainer: {
        borderWidth: 1, 
        borderColor: '#dcd8e8', 
        borderRadius: 8, 
        overflow: 'hidden', 
        marginBottom: 12,
        backgroundColor: COLOR_WHITE,
    },
    // 액션 버튼 (UploadEachScreen)
    compactButtonRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 12,
        marginBottom: 16,
    },
    compactButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLOR_LIGHT_GREEN,
        elevation: 3,
    },
    compactButtonText: {
        fontSize: 16,
        color: COLOR_WHITE,
    },
    kakaoBtn: {
        backgroundColor: '#facc15', // 카카오 노란색
    },
    mainActionButton: {
        flex: 1,
        padding: 10,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLOR_PRIMARY,
        elevation: 3,
        marginTop: 0,
    },
    mainButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLOR_WHITE,
    },
    // 썸네일 목록 스타일 (PhotoSelector, ThumbnailList 공용)
    thumbnailScroll: {
        marginTop: 8,
        marginBottom: 16,
    },
    thumbnailTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLOR_TEXT_LIGHT,
        marginBottom: 8,
    },
    thumbnailImage: {
        width: 120, 
        height: 90, 
        borderRadius: 8, 
    },
    // PhotoSelector 전용 크기/기본 스타일 (크기가 다름)
    thumbnailSize: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: 8,
        overflow: 'hidden',
        marginRight: 8,
        borderWidth: 2,
    },
    thumbnailImageFull: {
        width: '100%',
        height: '100%',
        resizeMode: 'stretch',
    },
    thumbnailSelectedBorder: {
        borderWidth: 3, 
        borderColor: COLOR_PRIMARY
    },
    thumbnailUnselectedBorder: {
        borderColor: '#dcd8e8',
    },
    // 삭제 버튼 오버레이
    thumbnailRemoveBtn: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLOR_ERROR,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        zIndex: 10,
    },
    thumbnailRemoveText: {
        color: COLOR_WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },
    // 회전 버튼 오버레이
    rotateBtnOverlay: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLOR_DARK_GREEN,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        zIndex: 10,
    },
    rotateBtnText: {
        color: COLOR_WHITE,
        fontSize: 16,
        fontWeight: 'bold',
    },

    // --- 3. 로그인 화면 스타일 (login 접두사 사용) ---
    loginHeader: { 
        backgroundColor: COLOR_PRIMARY, 
        paddingTop: 70, 
        paddingBottom: 40, 
        paddingHorizontal: 20, 
        alignItems: 'center',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        elevation: 5,
        borderBottomWidth: 2,
        borderBottomColor: COLOR_LIGHT_GREEN,
    },
    loginTitle: { fontSize: 30, fontWeight: 'bold', color: COLOR_WHITE, marginBottom: 6 },
    loginSubtitle: { fontSize: 16, color: '#e0e7ff', fontWeight: '500' },
    loginForm: { paddingHorizontal: 20, marginTop: 20 },
    
    // 입력 및 레이블
    loginLabel: { fontSize: 14, fontWeight: '600', color: COLOR_TEXT_LIGHT, marginBottom: 8, marginTop: 16 },
    loginInputRow: { flexDirection: 'row', alignItems: 'center' },
    loginInput: { 
        backgroundColor: COLOR_WHITE, 
        borderRadius: 12, 
        paddingVertical: 18, 
        paddingHorizontal: 16,
        fontSize: 16, 
        borderWidth: 1, 
        borderColor: '#e2e8f0', 
        flex: 1,
        color: COLOR_TEXT_DARK,
        textAlign: 'left',
        marginBottom: 8,
    },
    loginInputDisabled: {
        backgroundColor: '#f1f5f9',
        color: '#94a3b8',
    },
    loginPasswordInput: {
        fontWeight: 'bold',
    },
    loginErrorText: { color: COLOR_ERROR, fontSize: 14, marginTop: 4, marginBottom: 8 },

    // 버튼
    loginButton: { 
        backgroundColor: COLOR_LIGHT_GREEN,
        borderRadius: 12, 
        padding: 16, 
        alignItems: 'center', 
        marginTop: 16,
        elevation: 3,
    },
    loginButtonPrimary: {
        backgroundColor: COLOR_PRIMARY,
    },
    loginButtonText: { color: COLOR_WHITE, fontSize: 18, fontWeight: '700' },

    // 회사/팀 정보
    loginCompanyInfoRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 8, 
        paddingVertical: 10,
        backgroundColor: '#f3f0ff',
        paddingHorizontal: 12,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: COLOR_PRIMARY,
    },
    loginCompanyNameText: { fontSize: 16, fontWeight: '700', color: COLOR_TEXT_DARK },
    loginCompanyChangeButton: { padding: 5, borderRadius: 8 },
    loginCompanyChangeButtonText: { color: COLOR_ERROR, fontSize: 14, fontWeight: '500' },
    
    // 로딩 및 Picker
    loginLoadingContainer: { padding: 20, alignItems: 'center' },
    loginLoadingText: { marginTop: 12, fontSize: 14, color: COLOR_TEXT_LIGHT },
    loginPickerContainer: { 
        backgroundColor: COLOR_WHITE, 
        borderRadius: 12, 
        borderWidth: 1, 
        borderColor: '#dcd8e8', 
        marginBottom: 5, 
        height: 60, 
        justifyContent: 'center',
        overflow: 'hidden',
    },
    loginPicker: { 
        height: '100%', 
        color: COLOR_TEXT_DARK, 
        margin: 0, 
        padding: 0 
    },
});

export default styles;