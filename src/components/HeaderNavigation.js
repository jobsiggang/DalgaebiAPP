// src/components/HeaderNavigation.js

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from '../screens/styles/UploadCommonStyles'; 


export const MainHeader = ({ navigation, route }) => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const loadUser = async () => {
            try {
                const userData = await AsyncStorage.getItem('user');
                if (userData) {
                    setUser(JSON.parse(userData));
                }
            } catch (e) {
                console.error("Failed to load user data:", e);
                Alert.alert("오류", "사용자 정보 로드에 실패했습니다.");
            }
        };
        loadUser();
    }, []);

    const logout = async () => {
        try {
            // 로그아웃 시 사용자 정보 제외한 모든 데이터 삭제
            const userStr = await AsyncStorage.getItem('user');
            
            // 모든 키 조회
            const allKeys = await AsyncStorage.getAllKeys();
            
            // 삭제할 키 목록 (user 제외)
            const keysToRemove = allKeys.filter(key => key !== 'user');
            
            if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
                console.log('📦 임시 데이터 삭제 완료:', keysToRemove);
            }
            
            // 사용자 정보도 삭제
            await AsyncStorage.removeItem('user');
            
            // 로그인 화면으로 이동
            navigation.replace('Login');
        } catch (e) {
            console.error("Logout failed:", e);
            Alert.alert('오류', '로그아웃 중 오류가 발생했습니다.');
        }
    };

    return (
        <View style={headerStyles.container}>
            <View style={headerStyles.header}>
                <View>
                    <Text style={headerStyles.companyName}>
                        {user?.companyName || '회사명'}
                    </Text>
                    <Text style={headerStyles.userName}>
                        {user?.name || '사용자'}
                        {user?.username ? ` (${user.username})` : ''}
                    </Text>
                </View>
                <TouchableOpacity style={headerStyles.logoutButton} onPress={logout}>
                    <Text style={headerStyles.logoutText}>로그아웃</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};


const headerStyles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: styles.colorWhite,
        borderBottomWidth: 1,
        borderColor: '#e5e7eb',
        elevation: 2,
    },
    header: {
        padding: 16,
        backgroundColor: styles.colorBackground,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    companyName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: styles.colorPrimary
    },
    userName: {
        fontSize: 14,
        color: styles.colorTextLight,
        marginTop: 2
    },
    logoutButton: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: '#e5e7eb',
    },
    logoutText: {
        color: styles.colorError,
        fontWeight: 'bold',
        fontSize: 14
    },
});

export default MainHeader;