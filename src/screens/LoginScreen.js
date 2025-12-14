import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    StatusBar,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    StyleSheet,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API from '../config/api'; 
// 💡 공용 스타일 import (styles 객체를 통일하여 사용)
import styles from './styles/UploadCommonStyles'; 
// 주의: 공용 스타일 파일에 로그인 관련 스타일이 모두 추가되었다고 가정합니다.

const LoginScreen = ({ navigation }) => {
    // 1. 회사 및 팀 상태
    const [companyInput, setCompanyInput] = useState('');
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [teams, setTeams] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState('');

    // 2. 로그인 인증 상태
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // 3. UI 및 로딩 상태
    const [loading, setLoading] = useState(false);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [lookupError, setLookupError] = useState(null);

    // --------------------------------------------
    // 1) 초기 인증 및 토큰 확인 (checkAuth)
    // --------------------------------------------
    const checkAuth = async () => {
        try {
            const savedStr = await AsyncStorage.getItem('user');
            if (savedStr) {
                const user = JSON.parse(savedStr);
                if (user.token) {
                    // ⏱️ 타임아웃 설정 (5초)
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    
                    try {
                        const res = await fetch(API.userStatus, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${user.token}`,
                            },
                            body: JSON.stringify({ userId: user.userId }),
                            signal: controller.signal,
                        });
                        
                        clearTimeout(timeoutId);
                        const data = await res.json();
                        
                        if (res.ok && data.success && data.isActive !== false) {
                            const mode = await AsyncStorage.getItem('uploadMode');
                            navigation.replace('MainTabs', {
                                screen: mode === 'multi' ? 'UploadMulti' : 'UploadEach',
                            });
                            return true;
                        } else {
                            Alert.alert('접근 불가', '사용자 계정이 비활성화되었습니다. 관리자에게 문의하세요.');
                            await AsyncStorage.removeItem('user');
                            return false;
                        }
                    } catch (fetchErr) {
                        clearTimeout(timeoutId);
                        if (fetchErr.name === 'AbortError') {
                            console.warn("Auth check timeout - proceeding to login");
                        } else {
                            console.error("Auth check fetch error:", fetchErr);
                        }
                        // 토큰 검증 실패 시 저장된 정보로 자동 로그인 시도
                        const mode = await AsyncStorage.getItem('uploadMode');
                        navigation.replace('MainTabs', {
                            screen: mode === 'multi' ? 'UploadMulti' : 'UploadEach',
                        });
                        return true;
                    }
                }
            }
            return false;
        } catch (err) {
            console.error("Auth check failed:", err);
            return false;
        }
    };
    
    useEffect(() => {
        const initAuth = async () => {
            try {
                await checkAuth();
            } finally {
                // ✅ 반드시 setIsLoadingAuth(false)를 호출하여 로딩 상태 해제
                setIsLoadingAuth(false);
            }
        };
        initAuth();
    }, [navigation]);

    // --------------------------------------------
    // 2) 회사명으로 조회 및 팀 목록 불러오기
    // --------------------------------------------
    const handleCompanyLookup = async () => {
        if (!companyInput) {
            Alert.alert('오류', '회사명을 입력해주세요.');
            return;
        }
        setLoading(true);
        setLookupError(null);
        setSelectedCompany(null);

        try {
            const url = `${API.companyLookup}?name=${encodeURIComponent(companyInput)}`;
            console.log('📡 회사 조회 API 요청:', url);
            console.log('📡 API.companyLookup:', API.companyLookup);
            console.log('📡 입력값:', companyInput);
            
            const response = await fetch(url);
            console.log('📊 회사 조회 응답 상태:', response.status, response.statusText);
            
            const data = await response.json();

            console.log('📦 회사 조회 API 응답:', { 
                status: response.status, 
                success: data.success,
                hasCompany: !!data.company,
                fullData: JSON.stringify(data)
            });

            if (response.ok && data.success && data.company) {
                console.log('✅ 회사 조회 성공:', data.company);
                setSelectedCompany(data.company);
                console.log('🔄 fetchTeams 호출 예정 - companyId:', data.company._id);
                fetchTeams(data.company._id); 
            } else {
                console.error('❌ 회사 조회 실패:', {
                    ok: response.ok,
                    success: data.success,
                    hasCompany: !!data.company,
                    error: data.error
                });
                setLookupError(data.error || '일치하는 회사명을 찾을 수 없습니다.');
                Alert.alert('조회 실패', data.error || '회사 조회에 실패했습니다.');
            }
        } catch (error) {
            console.error('🔴 회사 조회 중 오류:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
            setLookupError('네트워크 오류가 발생했습니다.');
            Alert.alert('오류', '회사 조회 중 오류 발생: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // 🟢 팀 목록 조회 함수 (companyId 필요)
    const fetchTeams = async (companyId) => {
        setLoadingTeams(true);
        console.log('🔍 fetchTeams 호출됨. companyId:', companyId);
        try {
            const url = `${API.companyTeamsBase}/${companyId}/teams`;
            console.log('📡 팀 목록 API 요청:', url);
            console.log('📡 API.companyTeamsBase:', API.companyTeamsBase);
            
            const response = await fetch(url);
            console.log('📊 응답 상태:', response.status, response.statusText);
            
            const data = await response.json();
            console.log('📦 팀 목록 API 응답:', { 
                status: response.status, 
                success: data.success,
                teamsCount: data.teams ? data.teams.length : 0,
                fullData: JSON.stringify(data)
            });

            if (response.ok && data.success && data.teams && Array.isArray(data.teams)) {
                console.log('✅ 팀 목록 로드 성공:', data.teams);
                setTeams(data.teams);
                setSelectedTeamId('');
                if (data.teams.length === 0) {
                    Alert.alert('알림', '등록된 팀이 없습니다. 관리자에게 문의하세요.');
                }
            } else {
                console.error('❌ 팀 목록 조회 실패. 응답:', { 
                    ok: response.ok, 
                    success: data.success, 
                    hasTeams: !!data.teams,
                    isArray: Array.isArray(data.teams),
                    error: data.error 
                });
                setTeams([]);
                Alert.alert('조회 실패', data.error || '팀 목록 조회에 실패했습니다.');
            }
        } catch (error) {
            console.error('🔴 팀 목록 조회 중 오류:', {
                message: error.message,
                name: error.name,
                stack: error.stack
            });
            setTeams([]);
            Alert.alert('오류', '팀 목록 조회 중 오류: ' + error.message);
        } finally {
            setLoadingTeams(false);
        }
    };

    // --------------------------------------------
    // 3) 최종 로그인 버튼 처리 (handleLogin)
    // --------------------------------------------
    const handleLogin = async () => {
        if (!selectedCompany || !selectedTeamId) {
            Alert.alert('오류', '회사와 팀을 모두 선택해주세요.');
            return;
        }
        if (!username || !password) {
            Alert.alert('오류', '아이디와 비밀번호를 입력하세요');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(API.login, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    password,
                    companyId: selectedCompany._id,
                    teamId: selectedTeamId,
                }),
            });

            const data = await response.json();

            if (data.success) {
                const currentTeam = teams.find(t => t._id === selectedTeamId);
                
                const userObj = {
                    userId: data.user._id,
                    username: data.user.username,
                    role: data.user.role,
                    companyId: data.user.companyId,
                    teamId: data.user.teamId, 
                    name: data.user.name,
                    token: data.token,
                    companyName: selectedCompany.name, 
                    teamName: currentTeam ? currentTeam.name : '팀',
                    isActive: data.user.isActive, 
                };

                await AsyncStorage.setItem('user', JSON.stringify(userObj));

                const mode = await AsyncStorage.getItem('uploadMode');
                navigation.replace('MainTabs', {
                    screen: mode === 'multi' ? 'UploadMulti' : 'UploadEach',
                });
            } else {
                Alert.alert('로그인 실패', data.message || '자격 증명을 확인하세요.');
            }
        } catch (error) {
            Alert.alert('오류', '서버 연결 실패\n' + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    // --------------------------------------------
    // UI 렌더링
    // --------------------------------------------
    if (isLoadingAuth) {
        return (
            <View style={styles.centerContainer}>
                {/* styles.colorAccent는 공용 스타일에서 가져와야 합니다. */}
                <ActivityIndicator size="large" color={styles.colorAccent} />
                <Text style={styles.loadingText}>사용자 인증 확인 중...</Text>
            </View>
        );
    }
    
    return (
        <View style={styles.container}>
            {/* styles.colorPrimary는 공용 스타일에서 가져와야 합니다. */}
            <StatusBar barStyle="light-content" backgroundColor={styles.colorPrimary} />

            <View style={styles.loginHeader}> 
                <Text style={styles.loginTitle}>📸 달개비 현장 기록 앱</Text>
                <Text style={styles.loginSubtitle}>직원/팀장 로그인</Text>
            </View>

            <ScrollView style={styles.loginForm} keyboardShouldPersistTaps="handled">
                
                {/* 1단계: 회사명 입력 */}
                {!selectedCompany && (
                    <View>
                        <Text style={styles.loginLabel}>회사 이름</Text>
                        <View style={styles.loginInputRow}>
                            <TextInput
                                style={styles.loginInput}
                                placeholder="회사명을 정확히 입력하세요"
                                value={companyInput}
                                onChangeText={setCompanyInput}
                                disabled={loading}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>
                        {lookupError && <Text style={styles.loginErrorText}>{lookupError}</Text>}
                        <TouchableOpacity
                         style={[styles.loginButton, styles.loginButtonPrimary, loading && styles.buttonDisabled]}
                            onPress={handleCompanyLookup}
                            disabled={loading || !companyInput}
                        >
                            <Text style={styles.loginButtonText}>{loading ? '조회 중...' : '다음 (팀 선택)'}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 2 & 3단계: 팀 선택 및 로그인 폼 */}
                {selectedCompany && (
                    <View>
                        <View style={styles.loginCompanyInfoRow}>
                            <Text style={styles.loginCompanyNameText}>{selectedCompany.name} 소속</Text>
                            <TouchableOpacity
                                style={styles.loginCompanyChangeButton}
                                onPress={() => {
                                    setSelectedCompany(null);
                                    setTeams([]);
                                    setSelectedTeamId('');
                                    setUsername('');
                                    setPassword('');
                                }}
                                disabled={loading}
                            >
                                <Text style={styles.loginCompanyChangeButtonText}>회사 변경</Text>
                            </TouchableOpacity>
                        </View>

                        {loadingTeams ? (
                            <View style={styles.loginLoadingContainer}>
                                <ActivityIndicator size="small" color={styles.colorAccent} />
                                <Text style={styles.loginLoadingText}>팀 목록 로딩 중...</Text>
                            </View>
                        ) : (
                            <>
                                {teams.length === 0 ? (
                                    <View style={styles.loginPickerContainer}>
                                        <Text style={styles.loginErrorText}>
                                            등록된 팀이 없습니다. 
                                            {'\n'}teams 상태값: {JSON.stringify(teams)}
                                            {'\n'}selectedCompany: {selectedCompany ? selectedCompany._id : 'null'}
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        <Text style={styles.loginLabel}>소속 팀 선택</Text>
                                        <View style={styles.loginTeamButtonGroup}>
                                            {teams.map((team) => (
                                                <TouchableOpacity
                                                    key={team._id}
                                                    style={[
                                                        styles.loginTeamButton,
                                                        selectedTeamId === team._id && styles.loginTeamButtonSelected
                                                    ]}
                                                    onPress={() => {
                                                        console.log('🎯 팀 선택됨:', team._id, team.name);
                                                        setSelectedTeamId(team._id);
                                                    }}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.loginTeamButtonText,
                                                            selectedTeamId === team._id && styles.loginTeamButtonTextSelected
                                                        ]}
                                                        numberOfLines={1}
                                                    >
                                                        {team.name}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}

                                <Text style={styles.loginLabel}>아이디</Text>
                                <TextInput
                                    style={[styles.loginInput, !selectedTeamId && styles.loginInputDisabled]}
                                    placeholder="직원/팀장 아이디"
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    disabled={loading || !selectedTeamId}
                                />

                                <Text style={styles.loginLabel}>비밀번호</Text>
                                <TextInput
                                    style={[styles.loginInput, styles.loginPasswordInput, !selectedTeamId && styles.loginInputDisabled]}
                                    placeholder="비밀번호"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={true}
                                    autoCapitalize="none"
                                    disabled={loading || !selectedTeamId}
                                />

                                <TouchableOpacity
                                    style={[styles.loginButton, styles.loginButtonPrimary, loading && styles.buttonDisabled]}
                                    onPress={handleLogin}
                                    disabled={loading || !username || !password || !selectedTeamId}
                                >
                                    <Text style={styles.loginButtonText}>
                                        {loading ? <ActivityIndicator color="#fff" /> : '로그인'}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

/* * 🚨 주의 사항:
* 실제 프로젝트에서는 이 파일에 아래의 스타일 코드를 포함하는 대신, 
* `src/screens/styles/UploadCommonStyles.js` 파일에 
* `loginHeader`, `loginInput`, `loginButton` 등의 접두어를 붙인 스타일을
* 정의하고 내보내야 합니다.
*/

export default LoginScreen;