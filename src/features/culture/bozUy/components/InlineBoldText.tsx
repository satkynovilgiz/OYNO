import { Text, type TextStyle, type StyleProp } from 'react-native';

type InlineBoldTextProps = {
  text: string;
  style?: StyleProp<TextStyle>;
  boldStyle?: StyleProp<TextStyle>;
};

/** Renders `**bold**` spans in an otherwise plain string as bold Text
 * nodes. Deliberately not a markdown library - tip content only ever needs
 * this one inline-emphasis case. */
export function InlineBoldText({ text, style, boldStyle }: InlineBoldTextProps) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        const match = part.match(/^\*\*([^*]+)\*\*$/);
        if (match) {
          return (
            <Text key={index} style={[{ fontWeight: '700' }, boldStyle]}>
              {match[1]}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}
