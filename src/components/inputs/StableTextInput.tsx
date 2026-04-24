import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { TextInput, type TextInputProps } from "react-native";

const DEBOUNCE_MS = 80;

export type StableTextInputPassthroughProps = Pick<
  TextInputProps,
  | "multiline"
  | "scrollEnabled"
  | "onFocus"
  | "onContentSizeChange"
  | "placeholderTextColor"
  | "autoCapitalize"
  | "autoCorrect"
  | "keyboardType"
  | "autoComplete"
  | "textContentType"
  | "importantForAutofill"
  | "textAlignVertical"
  | "editable"
>;

export type StableTextInputProps = StableTextInputPassthroughProps & {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: StyleProp<TextStyle>;
};

function StableTextInputComponent({
  value,
  onChangeText,
  placeholder,
  style,
  ...rest
}: StableTextInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const scheduleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTextRef = useRef(value);
  const onChangeTextRef = useRef(onChangeText);

  onChangeTextRef.current = onChangeText;

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    latestTextRef.current = localValue;
  }, [localValue]);

  const clearSchedule = useCallback(() => {
    if (scheduleRef.current) {
      clearTimeout(scheduleRef.current);
      scheduleRef.current = null;
    }
  }, []);

  const handleChangeText = useCallback(
    (text: string) => {
      latestTextRef.current = text;
      setLocalValue(text);
      clearSchedule();
      scheduleRef.current = setTimeout(() => {
        scheduleRef.current = null;
        onChangeTextRef.current(text);
      }, DEBOUNCE_MS);
    },
    [clearSchedule],
  );

  useEffect(
    () => () => {
      if (scheduleRef.current !== null) {
        clearTimeout(scheduleRef.current);
        scheduleRef.current = null;
        onChangeTextRef.current(latestTextRef.current);
      }
    },
    [],
  );

  return (
    <TextInput
      {...rest}
      value={localValue}
      onChangeText={handleChangeText}
      placeholder={placeholder}
      style={style}
    />
  );
}

export default memo(StableTextInputComponent);
