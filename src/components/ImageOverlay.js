// src/components/ImageOverlay.js

import React, { forwardRef } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { canvasConfig } from '../config/compositeConfig';


// ImageComposer와 동일한 표 위치 계산 유틸리티
function getOverlayPosition(boardPosition, tableConfig, imageDims) {
    // margin 값을 tableConfig.tableMargin에서 통일해서 받음 (없으면 0)
    const margin = typeof tableConfig.tableMargin === 'number' ? tableConfig.tableMargin : 0;
    let left = 0, top = 0;
    switch (boardPosition) {
        case 'topLeft':
            left = margin;
            top = margin;
            break;
        case 'topRight':
            left = imageDims.width - tableConfig.tableWidth - margin;
            top = margin;
            break;
        case 'bottomLeft':
            left = margin;
            top = imageDims.height - tableConfig.tableHeight - margin;
            break;
        case 'bottomRight':
        default:
            left = imageDims.width - tableConfig.tableWidth - margin;
            top = imageDims.height - tableConfig.tableHeight - margin;
            break;
    }
    return { left, top };
}

const ImageOverlay = forwardRef(({
    selectedImage, // 원본 이미지 데이터 (uri, width, height, rotation)
    formData, 
    tableEntries, 
    tableConfig, // 테이블 설정 값
    previewDims, // 미리보기 뷰의 최종 크기 (미리보기 모드)
    canvasDims, // 캔버스 크기 (고해상도 캡처 모드)
    rotation, // 회전 각도
}, ref) => {
    // 🚨 previewDims 또는 canvasDims 중 하나를 사용 (우선순위: canvasDims > previewDims)
    const dims = canvasDims || previewDims;
    
    if (!selectedImage || !dims) return null;

    // 모든 스타일/좌표/폰트/마진 등 tableConfig에서만 가져옴
    const {
        col1FinalWidth, col2FinalWidth, tableWidth, tableHeight,
        fontSize, rowHeight, cellPaddingX, cellPaddingY,
        backgroundColor, borderColor, borderWidth, textColor,
        fontFamily, boardPosition = 'bottomRight',
    } = tableConfig;

    const overlayPos = getOverlayPosition(boardPosition, { tableWidth, tableHeight }, { width: dims.width, height: dims.height });

    const textStyle = {
        fontSize,
        color: textColor,
        fontWeight: 'bold',
        fontFamily,
    };

    // 이미지 크기 조정 (회전에 따라 가로세로 스왑)
    const imageFit = canvasConfig?.imageFit || 'stretch';
    const imageRotation = rotation ?? selectedImage.rotation ?? 0;
    const rotationNormalized = imageRotation % 360;
    
    // stretch 모드: 캔버스 전체를 채우기 (여백 없음)
    // 🚨 회전 시 가로세로 스왑 (90도, 270도일 때)
    let imgWidth = dims.width;
    let imgHeight = dims.height;
    
    if (rotationNormalized === 90 || rotationNormalized === 270) {
        // 90도 또는 270도 회전: 가로세로 스왑
        imgWidth = dims.height;
        imgHeight = dims.width;
    }


    const content = (
        <View style={{ width: dims.width, height: dims.height, position: 'relative', backgroundColor: '#fff' }}>
            {/* 1. 배경 이미지 (회전 적용) */}
            <Image
                source={{ uri: selectedImage.uri }}
                style={[
                    StyleSheet.absoluteFill,
                    {
                        resizeMode: 'stretch',
                        width: imgWidth,
                        height: imgHeight,
                        left: (dims.width - imgWidth) / 2,
                        top: (dims.height - imgHeight) / 2,
                        transform: [{ rotate: `${imageRotation}deg` }]
                    }
                ]}
            />
            {/* 2. 보드판 (테이블 오버레이) */}
            <View 
                key={`${tableConfig.col2FinalWidth}-${tableConfig.fontSize}`}
                style={{
                    position: 'absolute',
                    top: overlayPos.top,
                    left: overlayPos.left,
                    width: tableWidth,
                    height: tableHeight,
                    backgroundColor,
                    borderColor,
                    borderWidth,
                    overflow: 'hidden',
                }}
            >
                {tableEntries.map((entry, index) => {
                    const fieldName = typeof entry.field === 'object' ? entry.field.name : entry.field;
                    const value = formData[fieldName] || '';
                    const isLastRow = index === tableEntries.length - 1;
                    return (
                        <View
                            key={fieldName}
                            style={{
                                flexDirection: 'row',
                                height: rowHeight,
                                borderBottomColor: isLastRow ? 'transparent' : borderColor,
                                borderBottomWidth: isLastRow ? 0 : borderWidth,
                            }}
                        >
                            {/* 필드명 (Col 1) */}
                            <View
                                style={{
                                    width: col1FinalWidth,
                                    justifyContent: 'center',
                                    borderRightColor: borderColor,
                                    borderRightWidth: borderWidth,
                                    paddingHorizontal: cellPaddingX,
                                    paddingVertical: cellPaddingY,
                                }}
                            >
                                <Text style={textStyle}>{fieldName}</Text>
                            </View>
                            {/* 값 (Col 2) */}
                            <View
                                style={{
                                    width: col2FinalWidth,
                                    justifyContent: 'center',
                                    paddingHorizontal: cellPaddingX,
                                    paddingVertical: cellPaddingY,
                                }}
                            >
                                <Text style={textStyle}>{value}</Text>
                            </View>
                        </View>
                    );
                })}
            </View>
        </View>
    );

    // 🚨 canvasDims가 있으면 ViewShot으로 감싸기 (고해상도 캡처용)
    if (canvasDims) {
        return (
            <ViewShot 
                ref={ref} 
                options={{ format: 'jpg', quality: 1.0, width: canvasDims.width, height: canvasDims.height }}
                style={{ width: canvasDims.width, height: canvasDims.height, backgroundColor: '#fff' }}
            >
                {content}
            </ViewShot>
        );
    }

    // 미리보기 모드 (ref 필요 없음)
    return content;
});

ImageOverlay.displayName = 'ImageOverlay';

export default ImageOverlay;