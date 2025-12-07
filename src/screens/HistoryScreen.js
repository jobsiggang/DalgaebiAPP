// src/screens/HistoryScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Image,
    TouchableOpacity,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import API from '../config/api';

import { useFocusEffect } from '@react-navigation/native';
// 💡 공용 스타일 import
import styles from './styles/UploadCommonStyles.js'; 

const HistoryScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    // const [history, setHistory] = useState([]); // 사용되지 않음
    const [groupedHistory, setGroupedHistory] = useState({});
    const [selectedDate, setSelectedDate] = useState(null);
    const [user, setUser] = useState(null);

    // --- 1. 데이터 가져오기 (fetchHistory) ---
    const fetchHistory = useCallback(async () => {
        setLoading(true);
        try {
            const userData = await AsyncStorage.getItem('user');
            const userObj = userData ? JSON.parse(userData) : null;
            setUser(userObj);

            if (!userObj || !userObj.token) {
                Alert.alert('인증 오류', '다시 로그인해주세요.');
                setLoading(false);
                return;
            }

            const response = await axios.get(API.uploads, {
                headers: {
                    Authorization: `Bearer ${userObj.token}`,
                },
            });

            if (response.data.success) {
                const uploads = response.data.uploads || [];
                // 날짜별 그룹화
                const grouped = uploads.reduce((acc, upload) => {
                    const date = new Date(upload.createdAt).toLocaleDateString('ko-KR'); // 한국어 날짜 형식
                    if (!acc[date]) acc[date] = [];
                    acc[date].push(upload);
                    return acc;
                }, {});
                setGroupedHistory(grouped);
                // 첫 번째 날짜를 기본 선택 날짜로 설정
                if (Object.keys(grouped).length > 0) {
                    setSelectedDate(Object.keys(grouped)[0]);
                }
            } else {
                Alert.alert('서버 오류', response.data.error || '업로드 내역을 불러오지 못했습니다.');
            }
        } catch (error) {
            if (error.response) {
                Alert.alert(
                    '서버 오류',
                    `상태: ${error.response.status}\n메시지: ${error.response.data?.error || '오류 발생'}`
                );
            } else {
                Alert.alert('네트워크 오류', '서버에 연결할 수 없습니다.');
            }
        }
        setLoading(false);
    }, [setUser, setLoading, setGroupedHistory]);

    // --- 2. 탭 포커스 시 데이터 로드 (useFocusEffect) ---
    useFocusEffect(
        useCallback(() => {
            const loadUserAndFetch = async () => {
                const userData = await AsyncStorage.getItem('user');
                const userObj = userData ? JSON.parse(userData) : null;
                setUser(userObj);

                if (userObj && userObj.token) {
                    fetchHistory();
                } else {
                    setLoading(false);
                }
            };

            loadUserAndFetch();

            return () => {
                // 클린업 함수
            };
        }, [fetchHistory])
    );

    // --- 3. 로그아웃 (handleLogout) ---
    const handleLogout = async () => {
        try {
            await AsyncStorage.removeItem('user');
            setUser(null);
            navigation.replace('Login'); // replace 사용
        } catch (error) {
            console.error('Logout error', error);
        }
    };

    // --- 4. 개별 카드 렌더링 함수 (renderCard) ---
    const renderCard = (item) => (
        // 💡 key는 상위 컴포넌트에서 처리
        <View style={historyStyles.detailCard}>
            <Text style={historyStyles.cardTitle}>📂 {item.formName || '양식 이름 없음'}</Text>

            {item.thumbnails && item.thumbnails.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={historyStyles.thumbnailContainer}>
                    {item.thumbnails.map((thumb, idx) => (
                        <Image key={idx} source={{ uri: thumb }} style={historyStyles.thumbnail} />
                    ))}
                </ScrollView>
            )}

            {Object.entries(item.data || {}).map(([key, value]) => {
                // 특정 필드 제외 및 값 처리
                if (key === '업로드_시점' || key === '사용자' || key === '사용자명' || key === '회사명' || key === '팀명') return null;

                const displayValue = (value !== null && value !== undefined && value !== '')
                    ? String(value)
                    : '—';

                return (
                    <Text key={key} style={historyStyles.cardSubtitle}>
                        {`• ${key}: `}
                        <Text style={historyStyles.cardValue}>{displayValue}</Text>
                    </Text>
                );
            })}

            <Text style={historyStyles.cardDate}>
                업로드 시점: {new Date(item.createdAt).toLocaleString('ko-KR')}
            </Text>
        </View>
    );

    // --- 5. 로딩 화면 ---
    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={styles.colorPrimary} />
                <Text style={styles.loadingText}>내역 불러오는 중...</Text>
            </View>
        );
    }

    // --- 6. 메인 렌더링 ---
    const dates = Object.keys(groupedHistory).sort((a, b) => new Date(b) - new Date(a));

    return (
        <View style={styles.container}>
            <View style={historyStyles.header}>
                <Text style={historyStyles.headerTitle}>기록 내역 🧾</Text>
                <Text style={historyStyles.headerSubTitle}>
                    {user?.name}님 ({user?.teamName} / {user?.companyName})
                </Text>
            </View>
            
            <ScrollView style={historyStyles.mainContent}>
                {dates.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <Text style={historyStyles.noHistoryText}>업로드 내역이 없습니다.</Text>
                    </View>
                ) : (
                    <>
                        {/* 날짜 탭 목록 */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={historyStyles.dateTabContainer}>
                            {dates.map((date) => (
                                <TouchableOpacity
                                    key={date}
                                    style={[
                                        historyStyles.dateTab,
                                        selectedDate === date && historyStyles.dateTabSelected,
                                    ]}
                                    onPress={() => setSelectedDate(date)}
                                >
                                    <Text style={[
                                        historyStyles.dateTabText,
                                        selectedDate === date && historyStyles.dateTabTextSelected,
                                    ]}>
                                        {date} ({groupedHistory[date].length})
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* 상세 내역 */}
                        {selectedDate && (
                            <View style={historyStyles.historyList}>
                                <Text style={historyStyles.sectionTitle}>
                                    {selectedDate} 기록 ({groupedHistory[selectedDate].length}건)
                                </Text>
                                {groupedHistory[selectedDate].map(item => (
                                    <View key={item._id}>
                                        {renderCard(item)}
                                    </View>
                                ))}
                            </View>
                        )}
                    </>
                )}
                
                <TouchableOpacity onPress={handleLogout} style={historyStyles.logoutButton}>
                    <Text style={historyStyles.logoutButtonText}>로그아웃</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

// --- HistoryScreen 전용 스타일 ---
const historyStyles = StyleSheet.create({
    // 헤더 영역
    header: {
        backgroundColor: styles.colorPrimary,
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 15,
        elevation: 3,
        marginBottom: 10,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: styles.colorWhite,
        marginBottom: 4,
    },
    headerSubTitle: {
        fontSize: 14,
        color: '#e0e7ff',
    },
    mainContent: {
        flex: 1,
        paddingHorizontal: 16,
    },
    // 날짜 탭
    dateTabContainer: {
        marginBottom: 10,
        maxHeight: 50,
    },
    dateTab: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: styles.colorWhite,
        marginRight: 8,
    },
    dateTabSelected: {
        backgroundColor: styles.colorSecondary,
        borderColor: styles.colorSecondary,
        elevation: 2,
    },
    dateTabText: {
        fontSize: 14,
        color: styles.colorTextDark,
    },
    dateTabTextSelected: {
        color: styles.colorWhite,
        fontWeight: 'bold',
    },
    // 카드 및 목록
    historyList: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: styles.colorTextDark,
        marginTop: 10,
        marginBottom: 10,
    },
    detailCard: {
        backgroundColor: styles.colorWhite,
        padding: 15,
        borderRadius: 10,
        marginBottom: 15,
        borderLeftWidth: 4,
        borderLeftColor: styles.colorSecondary, // 보라색 액센트
        elevation: 1,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: styles.colorTextDark,
        marginBottom: 8,
    },
    cardSubtitle: { 
        fontSize: 13, 
        color: styles.colorTextLight, 
        marginTop: 3 
    },
    cardValue: {
        fontWeight: '600',
        color: styles.colorTextDark,
    },
    cardDate: { 
        fontSize: 12, 
        color: '#999', 
        marginTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        paddingTop: 5,
    },
    thumbnailContainer: { 
        flexDirection: 'row', 
        marginTop: 8, 
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        paddingBottom: 8,
    },
    thumbnail: { 
        width: 60, // 썸네일 크기 조정
        height: 60, 
        borderRadius: 5, 
        marginRight: 8 
    },
    noHistoryText: {
        fontSize: 16,
        color: styles.colorTextLight,
        marginTop: 50,
        textAlign: 'center',
    },
    logoutButton: {
        backgroundColor: styles.colorError,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginVertical: 20,
    },
    logoutButtonText: {
        color: styles.colorWhite,
        fontWeight: 'bold',
        fontSize: 16,
    }
});

export default HistoryScreen;