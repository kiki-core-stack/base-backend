import type { LocaleCatalogs } from '@kcs-project/pack/types/i18n';

import en from './messages/en';
import type { AppMessages } from './messages/types';
import zhTW from './messages/zh-TW';

export const appLocaleCatalogs: LocaleCatalogs<AppMessages> = {
    'en': en,
    'zh-TW': zhTW,
};
