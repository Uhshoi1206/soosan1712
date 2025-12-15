/**
 * HomepageHeader - Header with site settings context
 * Should be loaded with client:load for immediate interactivity
 */
import React from 'react';
import { CompareProvider } from '@/contexts/CompareContextAstro';
import { SiteSettingsProvider } from '@/contexts/SiteSettingsContext';
import Header from '../Header';
import type { SiteSettings } from '@/types/siteSettings';

interface HomepageHeaderProps {
    siteSettings?: Partial<SiteSettings>;
}

const HomepageHeader: React.FC<HomepageHeaderProps> = ({ siteSettings }) => {
    return (
        <SiteSettingsProvider settings={siteSettings}>
            <CompareProvider>
                <Header />
            </CompareProvider>
        </SiteSettingsProvider>
    );
};

export default HomepageHeader;
