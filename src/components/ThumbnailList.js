// src/components/ThumbnailList.js
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import styles from '../screens/styles/UploadCommonStyles.js';

const ThumbnailList = React.memo(({ items = [], thumbnails = [], selectedItemId, onSelect, onSelectThumbnail, onRemove }) => {
  const displayItems = items.length > 0 ? items : thumbnails;
  return (
    <View style={{ marginTop: 20, marginBottom: 16 }}>
        <Text style={styles.thumbnailTitle}>이미지 목록 ({displayItems.length}개)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {displayItems.map((item, index) => (
                <View key={item.id || index} style={{ position: 'relative' }}>
                    <TouchableOpacity
                        onPress={() => (onSelect || onSelectThumbnail)?.(item)}
                        style={[
                            styles.thumbnailSize,
                            (item.id || index) === selectedItemId ? { borderColor: styles.colorPrimary } : styles.thumbnailUnselectedBorder,
                            { marginRight: 12, borderRadius: 8 }
                        ]}
                    >
                        <Image
                            source={{ uri: item.uri }}
                            style={styles.thumbnailImageFull}
                        />
                        <Text style={{ position: 'absolute', bottom: 4, right: 4, fontSize: 10, backgroundColor: 'rgba(0,0,0,0.5)', color: styles.colorWhite, paddingHorizontal: 4, borderRadius: 2 }}>
                            {item.formDataSnapshot?.['이름'] || item.snapshot?.['일자']?.substring(5) || `#${index + 1}`}
                        </Text>
                    </TouchableOpacity>
                    {onRemove && (
                        <TouchableOpacity style={styles.thumbnailRemoveBtn} onPress={() => onRemove(item.id || index)}>
                            <Text style={styles.thumbnailRemoveText}>×</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ))}
        </ScrollView>
    </View>
  );
});

export default ThumbnailList;
