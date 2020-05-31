export const PROTOCOL_ROOM = 1000;
export const SHIDUR_ID = "ce332655-d702-40d0-83eb-a6b950976984";
export const GEO_IP_INFO = process.env.REACT_APP_GEO_IP_INFO;
export const DANTE_IN_IP = process.env.REACT_APP_DANTE_IN_IP;
export const JANUS_SRV_TRL = process.env.REACT_APP_JANUS_SRV_TRL;
export const JANUS_SRV_STR = process.env.REACT_APP_JANUS_SRV_STR;
export const STUN_SRV_TRL = process.env.REACT_APP_STUN_SRV_TRL;
export const STUN_SRV_STR = process.env.REACT_APP_STUN_SRV_STR;
export const JANUS_SRV_ADMIN = process.env.REACT_APP_JANUS_SRV_ADMIN;
export const ADMIN_SECRET = process.env.REACT_APP_ADMIN_SECRET;
export const SECRET = process.env.REACT_APP_SECRET;

export const audios_options = [
    { key: 'sr', value: 61, text: 'Source' },
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