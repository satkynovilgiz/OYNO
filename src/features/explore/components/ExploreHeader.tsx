import { Backpack, Search } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { IconButton, ScreenHeader } from '@/components/ui';

type ExploreHeaderProps = {
  editorialTitle?: boolean;
  onPressSearch?: () => void;
  onPressCollection?: () => void;
};

/** "Explore Kyrgyzstan through OYNO": eyebrow, title, one-line subtitle,
 * and two light actions - global Search and the discoveries collection. */
export function ExploreHeader({ editorialTitle, onPressSearch, onPressCollection }: ExploreHeaderProps) {
  const { t } = useTranslation();
  return (
    <ScreenHeader
      eyebrow={t('explore.header.title')}
      title={t('explore.v2.title')}
      subtitle={t('explore.v2.subtitle')}
      editorialTitle={editorialTitle}
      actions={
        <>
          <IconButton icon={Search} size={40} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('explore.v2.searchLabel')} onPress={onPressSearch} />
          <IconButton icon={Backpack} size={40} iconSize={20} shape="roundedSquare" elevated={false} accessibilityLabel={t('explore.header.collectionLabel')} onPress={onPressCollection} />
        </>
      }
    />
  );
}
