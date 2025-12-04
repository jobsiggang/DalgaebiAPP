const API_BASE_URL = 'https://dalgaebi-server.vercel.app';

export const API = {
    // 💡 기본 URL (클라이언트에서 동적 경로 구성 시 사용)
    baseApiUrl: API_BASE_URL,
    
    // ------------------------------------
    // Auth & Status Endpoints
    // ------------------------------------
    login: `${API_BASE_URL}/api/login`,
    userStatus: `${API_BASE_URL}/api/userStatus`,
    verifyUser: `${API_BASE_URL}/api/verifyUser`, 

    // ------------------------------------
    // Core Upload & Data Endpoints
    // ------------------------------------
    uploadPhoto: `${API_BASE_URL}/api/uploadPhoto`,
    uploads: `${API_BASE_URL}/api/uploads`, // 업로드 기록 조회/DB 기록용
    
    // ------------------------------------
    // 🟢 Dynamic Resource Base Paths
    // ------------------------------------
    
    // Step 1: 회사명으로 ID 조회
    companyLookup: `${API_BASE_URL}/api/companies/lookup`, 

    // 🟢 [핵심 수정] 회사/팀 리소스 조회의 베이스 경로
    // 사용 예: /api/companies/ID/teams/ID/forms
    companyTeamsBase: `${API_BASE_URL}/api/companies`, 
    
    companiesList: `${API_BASE_URL}/api/companies`, 
};

export default API;