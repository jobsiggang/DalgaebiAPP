import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Image, TextInput, StyleSheet, Alert,
    ActivityIndicator, StatusBar, Dimensions, PermissionsAndroid, Platform, Linking,
} from 'react-native';


// 공통 컴포넌트/훅 import

const FormField = React.memo(({ field, value, onChange, isDate, options, validationError, onOpenDatePicker }) => {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fff' }}>
            <Text style={{ width: '16.66%', textAlign: 'left', padding: 8, fontWeight: 'bold', color: '#222', fontSize: 14 }}>{field}</Text>
            <View style={{ flex: 1, marginLeft: '0%' }}>
                {isDate ? (
                    <TouchableOpacity
                        style={{ padding: 8, backgroundColor: '#f9fafb', borderRadius: 6, borderWidth: validationError ? 2 : 1, borderColor: validationError ? '#ef4444' : '#d1d5db', margin: 4, justifyContent: 'flex-start', alignItems: 'flex-start' }}
                        onPress={() => onOpenDatePicker(field)}
                    >
                        <Text style={{ fontSize: 14, color: '#222', textAlign: 'left' }}>{value || '날짜 선택'}</Text>
                    </TouchableOpacity>
                ) : options && options.length > 0 ? (
                    <ScrollView horizontal style={{ padding: 4 }} showsHorizontalScrollIndicator={false}>
                        {options.map(option => (
                            <TouchableOpacity
                                key={option}
                                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: value === option ? '#3b82f6' : '#f3f4f6', marginRight: 6, alignItems: 'flex-start' }}
                                onPress={() => onChange(option)}
                            >
                                <Text style={{ color: value === option ? '#fff' : '#222', fontWeight: 'bold', textAlign: 'left' }}>{option === '' ? '값 없음' : option}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                ) : (
                    <TextInput
                        style={{ padding: 8, fontSize: 14, color: '#222', backgroundColor: '#f9fafb', borderRadius: 6, borderWidth: validationError ? 2 : 1, borderColor: validationError ? '#ef4444' : '#d1d5db', margin: 4, textAlign: 'left' }}
                        value={value}
                        onChangeText={text => onChange(text)}
                        placeholder={field}
                        placeholderTextColor="#9ca3af"
                    />
                )}
                {validationError && <Text style={{ color: '#ef4444', fontSize: 12, paddingRight: 8 }}>(필수)</Text>}
            </View>
        </View>
    );
});
export default FormField;