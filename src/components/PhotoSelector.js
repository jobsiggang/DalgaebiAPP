// ./src/components/PhotoSelector.js
// 사진 선택, 썸네일, 회전, 삭제 등 UI/로직 컴포넌트

import React from 'react';
import { View, ScrollView, TouchableOpacity, Image, Text, StyleSheet } from 'react-native';
// 💡 공용 스타일 import
import styles from '../screens/styles/UploadCommonStyles'; 

export default function PhotoSelector({ images, selectedIndex, onSelect, onRemove, onRotate }) {
 return (
  <ScrollView horizontal style={styles.thumbnailScroll} showsHorizontalScrollIndicator={false}>
   {images.map((img, index) => (
    <View key={index} style={{ position: 'relative' }}>
     <TouchableOpacity
      onPress={() => onSelect(index)}
      style={[
                styles.thumbnailSize, // 💡 크기/테두리 기본값
                selectedIndex === index 
                    ? { borderColor: styles.colorPrimary } // 💡 선택 시 메인 색상
                    : styles.thumbnailUnselectedBorder // 💡 비선택 시 연한 회색
            ]}
     >
      <Image source={{ uri: img.uri }} style={styles.thumbnailImageFull} />
     </TouchableOpacity>

     {/* 삭제 버튼 (공용 스타일) */}
     <TouchableOpacity style={styles.thumbnailRemoveBtn} onPress={() => onRemove(index)}>
      <Text style={styles.thumbnailRemoveText}>✕</Text>
     </TouchableOpacity>
          
     {/* 회전 버튼 (공용 스타일) */}
     {onRotate && (
      <TouchableOpacity style={styles.rotateBtnOverlay} onPress={() => onRotate(index)}>
       <Text style={styles.rotateBtnText}>⟳</Text>
      </TouchableOpacity>
     )}
    </View>
   ))}
  </ScrollView>
 );
}