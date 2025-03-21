import React from 'react';
import { View, ViewProps } from 'react-native';

// Interfaccia per le props che può ricevere il componente
interface PointerEventsWrapperProps extends ViewProps {
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
  children: React.ReactNode;
}

// Componente che gestisce correttamente pointerEvents all'interno dello style
const PointerEventsWrapper: React.FC<PointerEventsWrapperProps> = ({
  pointerEvents,
  children,
  style,
  ...props
}) => {
  // Integra pointerEvents nello stile
  const mergedStyle = {
    ...(style as object),
    pointerEvents,
  };

  return (
    <View style={mergedStyle} {...props}>
      {children}
    </View>
  );
};

export default PointerEventsWrapper; 