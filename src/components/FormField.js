// src/components/FormField.js

import React, { useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
// 💡 공용 스타일 import
import styles from '../screens/styles/UploadCommonStyles'; 

const FormField = React.memo(({ 
    field, 
    value, 
    onChange, 
    isDate, 
    options, 
    validationError, 
    onOpenDatePicker,
    // type 및 placeholder는 현재 코드에서 사용되지 않지만, API는 유지
    type,
    placeholder
}) => {
    const inputRef = useRef();
    
    // 유효성 검사 에러 시 스타일
    const errorBorder = validationError ? 2 : 1;
    const errorColor = validationError ? styles.colorError : '#d1d5db'; // #d1d5db는 공용스타일 내부에 없으므로 임시로 하드코딩 유지

    return (
        <View style={formStyles.rowContainer}>
            {/* 1열: 필드명 */}
            <Text style={formStyles.fieldLabel}>{field}</Text>
            
            {/* 2열: 입력 필드 */}
            <View style={formStyles.fieldContent}>
                
                {isDate ? (
                    /* 1. 날짜 입력 */
                    <TouchableOpacity
                        style={[
                            formStyles.dateButton, 
                            { 
                                borderWidth: errorBorder, 
                                borderColor: errorColor 
                            }
                        ]}
                        onPress={() => onOpenDatePicker(field)}
                    >
                        <Text style={formStyles.dateText}>{value || '날짜 선택'}</Text>
                    </TouchableOpacity>
                ) : options && options.length > 0 ? (
                    /* 2. 옵션 선택 (스크롤) */
                    <ScrollView horizontal style={formStyles.optionsScroll} showsHorizontalScrollIndicator={false}>
                        {options.map((option) => (
                            <TouchableOpacity
                                key={option}
                                style={[
                                    formStyles.optionButton,
                                    { 
                                        backgroundColor: value === option ? styles.colorPrimary : '#f3f4f6' // #f3f4f6은 공용스타일 내부에 없으므로 임시 유지
                                    }
                                ]}
                                onPress={() => onChange(option)}
                            >
                                <Text style={{ 
                                    color: value === option ? styles.colorWhite : styles.colorTextDark, 
                                    fontWeight: 'bold' 
                                }}>
                                    {option === '' ? '값 없음' : option}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                ) : (
                    /* 3. 텍스트 입력 (기본) */
                    <TextInput
                        ref={inputRef}
                        style={[
                            formStyles.textInput,
                            { 
                                borderWidth: errorBorder, 
                                borderColor: errorColor 
                            }
                        ]}
                        value={value}
                        onChangeText={text => onChange(text)}
                        placeholder={field}
                        placeholderTextColor={styles.colorTextLight}
                    />
                )}
                
                {/* 유효성 검사 에러 메시지 */}
                {validationError && <Text style={formStyles.errorText}>(필수)</Text>}
            </View>
        </View>
    );
});

// 💡 FormField 전용 스타일 (공용 스타일의 값을 참조하여 사용)
const formStyles = StyleSheet.create({
    rowContainer: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        borderBottomWidth: 1, 
        borderBottomColor: '#eee', // 연한 회색 (업로드 화면의 공용 구분선)
        backgroundColor: styles.colorWhite,
    },
    fieldLabel: { 
        width: '16.66%', // 1/6 너비 (기존 코드 유지)
        textAlign: 'left', 
        padding: 8, 
        fontWeight: 'bold', 
        color: styles.colorTextDark, 
        fontSize: 14 
    },
    fieldContent: { 
        flex: 1, 
        marginLeft: '0%',
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 8,
    },
    // 1. 날짜 버튼 스타일
    dateButton: { 
        padding: 8, 
        backgroundColor: '#f9fafb', // 연한 배경
        borderRadius: 6, 
        margin: 4, 
        justifyContent: 'flex-start', 
        alignItems: 'flex-start',
        flex: 1,
    },
    dateText: { 
        fontSize: 14, 
        color: styles.colorTextDark, 
        textAlign: 'left' 
    },
    // 2. 옵션 스크롤 스타일
    optionsScroll: { 
        paddingVertical: 4, 
        paddingHorizontal: 0,
        flex: 1,
    },
    optionButton: { 
        paddingHorizontal: 10, 
        paddingVertical: 6, 
        borderRadius: 6, 
        marginRight: 6, 
        alignItems: 'flex-start' 
    },
    // 3. 텍스트 입력 스타일
    textInput: { 
        flex: 1, 
        padding: 8, 
        fontSize: 14, 
        color: styles.colorTextDark, 
        backgroundColor: '#f9fafb', 
        borderRadius: 6, 
        margin: 4, 
        textAlign: 'left',
        minHeight: 40, // 최소 높이 설정
    },
    // 에러 텍스트
    errorText: { 
        color: styles.colorError, 
        fontSize: 12, 
        paddingRight: 8,
        marginLeft: 8, // 입력 필드와 간격
    }
});

export default FormField;