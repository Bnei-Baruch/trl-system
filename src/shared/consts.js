
export const MAX_FEEDS = 20;
export const DATA_PORT = 5102;
export const PROTOCOL_ROOM = 1000;
export const SHIDUR_ID = "ce332655-d702-40d0-83eb-a6b950976984";
export const GEO_IP_INFO = process.env.REACT_APP_GEO_IP_INFO;
export const DANTE_IN_IP = process.env.REACT_APP_DANTE_IN_IP;
export const WFRP_STATE = process.env.REACT_APP_WFRP_STATE;
export const WFDB_STATE = process.env.REACT_APP_WFDB_STATE;
export const JANUS_SERVER = process.env.REACT_APP_JANUS_SERVER;
export const JANUS_ADMIN = process.env.REACT_APP_JANUS_ADMIN;
export const STUN_SERVER = process.env.REACT_APP_STUN_EUR_SRV;
export const STUN_SRV_STR = process.env.REACT_APP_STUN_SRV_STR;
export const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;
export const SECRET = process.env.REACT_APP_SECRET;
export const JANUS_SRV_ISRPT = process.env.REACT_APP_JANUS_SRV_ISRPT;
export const JANUS_SRV_EURFR = process.env.REACT_APP_JANUS_SRV_EURFR;
export const JANUS_SRV_EURUK = process.env.REACT_APP_JANUS_SRV_EURUK;
export const JANUS_SRV_ISRLC = process.env.REACT_APP_JANUS_SRV_ISRLC;
export const JANUS_IP_ISRPT = process.env.REACT_APP_JANUS_IP_ISRPT;
export const JANUS_IP_EURND = process.env.REACT_APP_JANUS_IP_EURND;
export const JANUS_IP_EURUK = process.env.REACT_APP_JANUS_IP_EURUK;

export const videos_options = [
    { key: 1, text: '600Kb/s', value: 1 },
    { key: 2, text: '300Kb/s', value: 11 },
    { key: 3, text: 'NoVideo', value: 3 },
];

export const admin_videos_options = [
    { key: 1, text: '600Kb/s', value: 1 },
    { key: 2, text: '300Kb/s', value: 11 },
    { key: 3, text: 'RTCP', value: 103 },
    { key: 4, text: 'NoVideo', value: 4 },
];

export const audiog_options = [
    { key: 'he', value: 15, flag: 'il', text: 'Hebrew' },
    { key: 'ru', value: 23, flag: 'ru', text: 'Russian' },
    { key: 'en', value: 24, flag: 'us', text: 'English' },
    { key: 'es', value: 26, flag: 'es', text: 'Spanish' },
    { key: 'fr', value: 25, flag: 'fr', text: 'French' },
    { key: 'it', value: 28, flag: 'it', text: 'Italian' },
    { key: 'de', value: 27, flag: 'de', text: 'German' },
    { key: 'tr', value: 42, flag: 'tr', text: 'Turkish' },
    { key: 'pt', value: 41, flag: 'pt', text: 'Portuguese' },
    { key: 'bg', value: 43, flag: 'bg', text: 'Bulgarian' },
    { key: 'ka', value: 44, flag: 'ge', text: 'Georgian' },
    { key: 'ro', value: 45, flag: 'ro', text: 'Romanian' },
    { key: 'hu', value: 46, flag: 'hu', text: 'Hungarian' },
    { key: 'sv', value: 47, flag: 'se', text: 'Swedish' },
    { key: 'lt', value: 48, flag: 'lt', text: 'Lithuanian' },
    { key: 'hr', value: 49, flag: 'hr', text: 'Croatian' },
    { key: 'ja', value: 50, flag: 'jp', text: 'Japanese' },
    { key: 'sl', value: 51, flag: 'si', text: 'Slovenian' },
    { key: 'pl', value: 52, flag: 'pl', text: 'Polish' },
    { key: 'no', value: 53, flag: 'no', text: 'Norwegian' },
    { key: 'lv', value: 54, flag: 'lv', text: 'Latvian' },
    { key: 'ua', value: 55, flag: 'ua', text: 'Ukrainian' },
    { key: 'nl', value: 56, flag: 'nl', text: 'Dutch' },
    { key: 'cn', value: 57, flag: 'cn', text: 'Chinese' },
    { key: 'et', value: 58, flag: 'et', text: 'Amharic' },
    { key: 'in', value: 59, flag: 'in', text: 'Hindi' },
    { key: 'ir', value: 60, flag: 'ir', text: 'Persian' },
];

export const audios_options = [
    { key: 'he', value: 15, text: 'Hebrew' },
    { key: 'ru', value: 23, text: 'Russian' },
    { key: 'en', value: 24, text: 'English' },
    { key: 'es', value: 26, text: 'Spanish' },
    { key: 'fr', value: 25, text: 'French' },
    { key: 'it', value: 28, text: 'Italian' },
    { key: 'de', value: 27, text: 'German' },
    { key: 'tr', value: 42, text: 'Turkish' },
    { key: 'pt', value: 41, text: 'Portuguese' },
    { key: 'bg', value: 43, text: 'Bulgarian' },
    { key: 'ka', value: 44, text: 'Georgian' },
    { key: 'ro', value: 45, text: 'Romanian' },
    { key: 'hu', value: 46, text: 'Hungarian' },
    { key: 'sv', value: 47, text: 'Swedish' },
    { key: 'lt', value: 48, text: 'Lithuanian' },
    { key: 'hr', value: 49, text: 'Croatian' },
    { key: 'ja', value: 50, text: 'Japanese' },
    { key: 'sl', value: 51, text: 'Slovenian' },
    { key: 'pl', value: 52, text: 'Polish' },
    { key: 'no', value: 53, text: 'Norwegian' },
    { key: 'lv', value: 54, text: 'Latvian' },
    { key: 'ua', value: 55, text: 'Ukrainian' },
    { key: 'nl', value: 56, text: 'Dutch' },
    { key: 'cn', value: 57, text: 'Chinese' },
    { key: 'et', value: 58, text: 'Amharic' },
    { key: 'in', value: 59, text: 'Hindi' },
    { key: 'ir', value: 60, text: 'Persian' },
];

export const lnglist = {
    Hebrew : {port: 5150, streamid: 15, trlid: 301},
    Russian : {port: 5230, streamid: 23, trlid: 302},
    English : {port: 5240, streamid: 24, trlid: 303},
    French : {port: 5250, streamid: 25, trlid: 305},
    Spanish : {port: 5260, streamid: 26, trlid: 304},
    German : {port: 5270, streamid: 27, trlid: 307},
    Italian : {port: 5280, streamid: 28, trlid: 306},
    Turkish : {port: 5300, streamid: 42},
    Portuguese : {port: 5320, streamid: 41},
    Bulgarian : {port: 5340, streamid: 43},
    Georgian : {port: 5360, streamid: 44},
    Romanian : {port: 5380, streamid: 45},
    Hungarian : {port: 5400, streamid: 46},
    Swedish : {port: 5420, streamid: 47},
    Lithuanian : {port: 5440, streamid: 48},
    Croatian : {port: 5460, streamid: 49},
    Japanese : {port: 5480, streamid: 50},
    Slovenian : {port: 5500, streamid: 51},
    Polish : {port: 5520, streamid: 52},
    Norvegian : {port: 5540, streamid: 53},
    Latvian : {port: 5560, streamid: 54},
    Ukrainian : {port: 5580, streamid: 55},
    Niderland : {port: 5600, streamid: 56},
    China : {port: 5620, streamid: 57},
    Amharic : {port: 5660, streamid: 58},
    Hindi : {port: 5670, streamid: 59},
    Persian : {port: 5680, streamid: 60},
};

export const gxycol = [0, 201, 203, 202, 204];

export const trllang = {
    "Hebrew": 301,
    "Russian": 302,
    "English": 303,
    "French": 305,
    "Spanish": 304,
    "German": 307,
    "Italian": 306
};