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
import API from '../config/api'; // API는 최종 구조를 사용합니다.

const LoginScreen = ({ navigation }) => {
    // 💡 1. 회사 및 팀 상태
    const [companyInput, setCompanyInput] = useState(''); // 사용자가 입력하는 회사명
    const [selectedCompany, setSelectedCompany] = useState(null); // 조회된 회사 객체 ({_id, name})
    const [teams, setTeams] = useState([]); // 해당 회사의 팀 목록
    const [selectedTeamId, setSelectedTeamId] = useState(''); // 선택된 팀 ID

    // 2. 로그인 인증 상태
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // 3. UI 및 로딩 상태
    const [loading, setLoading] = useState(false); // 일반 로딩 (버튼, API 호출)
    const [loadingTeams, setLoadingTeams] = useState(false); // 팀 목록 로딩
    const [isLoadingAuth, setIsLoadingAuth] = useState(true); // 초기 인증 로딩
    const [lookupError, setLookupError] = useState(null); // 회사 조회 오류

    // --------------------------------------------
    // 1) 초기 인증 및 토큰 확인 (checkAuth)
    // --------------------------------------------
    const checkAuth = async () => {
        try {
            // 🚨 실제 checkAuth 로직: 토큰 유효성 검사 및 자동 리디렉션
            const savedStr = await AsyncStorage.getItem('user');
            if (savedStr) {
                const user = JSON.parse(savedStr);
                if (user.token) {
                    // 서버에서 사용자 활성화 상태 확인
                    const res = await fetch(API.userStatus, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${user.token}`,
                        },
                        body: JSON.stringify({ userId: user.userId }),
                    });
                    const data = await res.json();
                    if (res.ok && data.success && data.isActive !== false) {
                        navigation.replace('MainTabs', { screen: 'UploadEach' });
                        return true;
                    } else {
                        Alert.alert('접근 불가', '사용자 계정이 비활성화되었습니다. 관리자에게 문의하세요.');
                        await AsyncStorage.removeItem('user');
                        return false;
                    }
                }
            }
            return false;
        } catch (err) {
            return false;
        }
    };
    
    useEffect(() => {
        const initAuth = async () => {
            await checkAuth();
            setIsLoadingAuth(false);
        };
        initAuth();
    }, []);

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
            // 🚨 API.companyLookup 사용 (Step 1)
            const response = await fetch(`${API.companyLookup}?name=${encodeURIComponent(companyInput)}`);
            const data = await response.json();

            if (response.ok && data.success && data.company) {
                setSelectedCompany(data.company);
                fetchTeams(data.company._id); 
            } else {
                setLookupError(data.error || '일치하는 회사명을 찾을 수 없습니다.');
                Alert.alert('조회 실패', data.error || '회사 조회에 실패했습니다.');
            }
        } catch (error) {
            setLookupError('네트워크 오류가 발생했습니다.');
            Alert.alert('오류', '회사 조회 중 오류 발생');
        } finally {
            setLoading(false);
        }
    };

    // 🟢 팀 목록 조회 함수 (companyId 필요)
    const fetchTeams = async (companyId) => {
        setLoadingTeams(true);
        try {
            // 🚨 [수정 반영] API.companyTeamsBase를 사용하여 /api/companies/ID/teams 경로로 조회
            const response = await fetch(`${API.companyTeamsBase}/${companyId}/teams`);
            const data = await response.json();
        //    Alert.alert("팀:",JSON.stringify(data))
            if (response.ok && data.success && data.teams) {
                setTeams(data.teams);
                if (data.teams.length > 0) {
                    setSelectedTeamId(data.teams[0]._id);
                } else {
                    setSelectedTeamId('');
                    Alert.alert('알림', '등록된 팀이 없습니다.');
                }
            } else {
                setTeams([]);
                Alert.alert('조회 실패', data.error || '팀 목록 조회에 실패했습니다.');
            }
        } catch (error) {
            console.error('Fetch teams error:', error);
            setTeams([]);
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
            // 🚨 최종 로그인 API: 팀 ID 포함
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
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>사용자 인증 확인 중...</Text>
            </View>
        );
    }
    
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#3b82f6" />

            <View style={styles.header}>
                <Text style={styles.title}>📸 현장 기록 앱</Text>
                <Text style={styles.subtitle}>팀/직원 로그인</Text>
            </View>

            <ScrollView style={styles.form}>
                
                {/* 1단계: 회사명 입력 */}
                {!selectedCompany && (
                    <View>
                        <Text style={styles.label}>회사 이름</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="회사명을 정확히 입력하세요"
                            value={companyInput}
                            onChangeText={setCompanyInput}
                            disabled={loading}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {lookupError && <Text style={styles.errorText}>{lookupError}</Text>}
                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleCompanyLookup}
                            disabled={loading || !companyInput}
                        >
                            <Text style={styles.buttonText}>{loading ? '조회 중...' : '다음 (팀 선택)'}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* 2 & 3단계: 팀 선택 및 로그인 폼 */}
                {selectedCompany && (
                    <View>
                        <View style={styles.companyInfoRow}>
                            <Text style={styles.companyNameText}>{selectedCompany.name}</Text>
                            <TouchableOpacity
                                style={styles.companyChangeButton}
                                onPress={() => {
                                    setSelectedCompany(null);
                                    setTeams([]);
                                    setSelectedTeamId('');
                                    setUsername('');
                                    setPassword('');
                                }}
                                disabled={loading}
                            >
                                <Text style={styles.backButtonText}>회사 변경</Text>
                            </TouchableOpacity>
                        </View>

                        {loadingTeams ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="#3b82f6" />
                                <Text style={styles.loadingText}>팀 목록 로딩 중...</Text>
                            </View>
                        ) : (
                            <>
                                <Text style={styles.label}>소속 팀 선택</Text>
                                <View style={styles.pickerContainer}>
                                    <Picker
                                        selectedValue={selectedTeamId}
                                        onValueChange={(itemValue) => setSelectedTeamId(itemValue)}
                                        style={styles.picker}
                                        enabled={!loading && teams.length > 0}
                                        mode="dropdown"
                                    >
                                        <Picker.Item label="팀을 선택하세요" value="" enabled={false} />
                                        {teams.map((team) => (
                                            <Picker.Item
                                                key={team._id}
                                                label={team.name}
                                                value={team._id}
                                            />
                                        ))}
                                    </Picker>
                                </View>

                                <Text style={styles.label}>아이디</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="직원/팀장 아이디"
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    disabled={loading || !selectedTeamId}
                                />

                                <Text style={styles.label}>비밀번호</Text>
                                <TextInput
                                    style={[styles.input, { color: '#111', fontWeight: 'bold' }]}
                                    placeholder="비밀번호"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={true}
                                    autoCapitalize="none"
                                    disabled={loading || !selectedTeamId}
                                />

                                <TouchableOpacity
                                    style={[styles.button, loading && styles.buttonDisabled]}
                                    onPress={handleLogin}
                                    disabled={loading || !username || !password || !selectedTeamId}
                                >
                                    <Text style={styles.buttonText}>
                                        {loading ? <ActivityIndicator color="#fff" /> : '로그인'}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                        <TouchableOpacity
                            style={[styles.backButton]}
                            onPress={() => setSelectedCompany(null)}
                            disabled={loading}
                        >
                            <Text style={styles.backButtonText}>회사명 다시 입력</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f3f4f6' },
    header: { backgroundColor: '#3b82f6', paddingTop: 60, paddingBottom: 40, paddingHorizontal: 20, alignItems: 'center' },
    title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
    subtitle: { fontSize: 16, color: '#e0e7ff' },
    form: { padding: 20, marginTop: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 8 },
    pickerContainer: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', marginBottom: 12, height: 56, justifyContent: 'center' },
    picker: { height: '100%', flex: 1, color: '#000' },
    selectedText: { fontSize: 14, color: '#3b82f6', marginTop: 8, marginBottom: 8, lineHeight: 20 },
    companyInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 10 },
    companyNameText: { fontSize: 18, fontWeight: '600', color: '#3b82f6' },
    companyChangeButton: { padding: 5, borderRadius: 5 },
    loadingContainer: { padding: 20, alignItems: 'center' },
    loadingText: { marginTop: 12, fontSize: 14, color: '#6b7280' },
    input: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, fontSize: 16, borderWidth: 1, borderColor: '#d1d5db', height: 56 },
    button: { backgroundColor: '#3b82f6', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
    buttonDisabled: { backgroundColor: '#9ca3af' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    errorText: { color: '#ef4444', fontSize: 14, marginTop: 4 },
    backButton: { marginTop: 20, alignItems: 'center' },
    backButtonText: { color: '#3b82f6', fontSize: 14, fontWeight: '500' }
});

export default LoginScreen;