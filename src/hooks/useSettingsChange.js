import { useEffect, useState } from 'react';
import { useBackgroundContext } from '../providers/Background';
import BrowserExtension from '../services/common/browser/browser-extension';
import BrowserNotification from '../services/common/browser/browser-notification';
import BrowserTranslate from '../services/common/browser/browser-translate';
import CoreClient from '../services/common/core-client';
import { settings } from '../services/common/persistent/settings';

const defaultCoreSettings = {
    useCore: false,
    apikey: {
        value: '',
        valid: undefined,
        groupClass: {},
        iconClass: {}
    },
    url: {
        value: '',
        valid: undefined,
        groupClass: {},
        iconClass: {}
    },
    rule: {
        value: ''
    },
    scanRules: []
};

export default (initialCoreSettings = defaultCoreSettings) => {
    const { MCL, gaTrackEvent } = useBackgroundContext();
    const [currentSettings, setCurrentSettings] = useState({});
    const [coreSettings, setCoreSettings] = useState(initialCoreSettings);

    /**
     * Update settings on change
     * @param {string} key 
     * @param {object} coreSettingsParam 
     */
    const onSettingsChanged = async (key, coreSettingsParam) => {
        console.log('coreSettingsParam', coreSettingsParam);
        if (key === 'coreSettings') {
            settings.coreApikey = coreSettingsParam.apikey;
            settings.coreUrl = coreSettingsParam.url;
            settings.coreV4 = coreSettingsParam.isCoreV4;

            const validCore = await validateCoreSettings();

            if (validCore) {
                settings.useCore = coreSettingsParam.useCore;
                settings.coreRule = coreSettings.rule.value;
                await BrowserNotification.create(BrowserTranslate.getMessage('coreSettingsSavedNotification'), 'info');
            } else {
                settings.useCore = false;
                await BrowserNotification.create(BrowserTranslate.getMessage('coreSettingsInvalidNotification'), 'info');
            }
        }

        if (key === 'useCore') {
            const useCore = !coreSettings.useCore;
            setCoreSettings({ ...coreSettings, useCore: useCore });

            if (useCore || await validateCoreSettings()) {
                settings.useCore = useCore;
            } else {
                settings.useCore = false;
            }

        } else if (key === 'scanDownloads' && !settings[key]) {
            const isAllowedFileSchemeAccess = await BrowserExtension.isAllowedFileSchemeAccess();
            settings[key] = isAllowedFileSchemeAccess;
        } else {
            settings[key] = !settings[key];
        }

        await settings.save();

        gaTrackEvent(['_trackEvent', MCL.config.gaEventCategory.name, MCL.config.gaEventCategory.action.settingsChanged, key, (settings[key] ? 'enabled' : 'disabled')]);
    };

    /** Validate core settings based on user's updates */
    const validateCoreSettings = async () => {
        if (!settings.coreApikey || !settings.coreUrl) {
            return;
        }
        CoreClient.configure({
            apikey: settings.coreApikey,
            endpoint: settings.coreUrl
        });

        try {
            await CoreClient.version();
            // const rules = await CoreClient.rules('');
            // coreSettings.scanRules = rules.map(rule => rule.name);
            coreSettings.scanRules = ['multiscan'];
            setCoreSettings({...coreSettings, scanRules: ['multiscan'], useCore:settings.useCore, coreV4:settings.coreV4, coreApikey: settings.coreApikey, coreUrl:settings.coreUrl});

            return true;
        } catch (error) {
            if (error.statusCode === 403) {
                setCoreSettings({ ...coreSettings, useCore: false });
                return false;
            }

            return false;
        }
    };

    useEffect(() => {
        (async () => {
            const settingsData = await settings.load();
            setCurrentSettings(settingsData.settings);
            setCoreSettings({
                ...coreSettings,
                useCore: settingsData.settings.useCore,
                apikey: {
                    value: settingsData.settings.coreApikey || ''
                },
                url: {
                    value: settingsData.settings.coreUrl || ''
                },
                rule: {
                    value: settingsData.settings.coreRule || ''
                }
            });
        })();
    }, []);

    return { currentSettings, coreSettings, onSettingsChanged, setCoreSettings, validateCoreSettings };
};
