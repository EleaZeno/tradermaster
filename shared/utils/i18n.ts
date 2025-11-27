
export const TRANSLATIONS: Record<string, Record<string, string>> = {
  zh: {
    'settings.title': '游戏设置',
    'settings.language': '语言',
    'settings.notifications': '通知过滤',
    'settings.notif.trades': '交易成功消息',
    'settings.notif.achievements': '成就解锁消息',
    'settings.notif.news': '突发新闻消息',
    'settings.close': '关闭',
    'header.title': '伊甸谷 EcoTycoon',
    'header.achievements': '成就',
    'header.pause': '暂停',
    'header.resume': '继续',
    'toast.clear': '清除全部'
  },
  en: {
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.notifications': 'Notifications',
    'settings.notif.trades': 'Trade Success',
    'settings.notif.achievements': 'Achievements',
    'settings.notif.news': 'Breaking News',
    'settings.close': 'Close',
    'header.title': 'Eden Valley',
    'header.achievements': 'Trophies',
    'header.pause': 'Pause',
    'header.resume': 'Resume',
    'toast.clear': 'Clear All'
  }
};

export const getTranslation = (key: string, lang: 'zh' | 'en') => {
    return TRANSLATIONS[lang]?.[key] || key;
};
