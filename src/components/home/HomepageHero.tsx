/**
 * HomepageHero - Above-the-fold hero section
 * Should be loaded immediately (no lazy loading)
 */
import React from 'react';
import { SiteSettingsProvider } from '@/contexts/SiteSettingsContext';
import Hero from '../Hero';
import type { Banner } from '../BannerCarousel';
import type { SiteSettings } from '@/types/siteSettings';

interface HomepageHeroProps {
    banners?: Banner[];
    siteSettings?: Partial<SiteSettings>;
}

const HomepageHero: React.FC<HomepageHeroProps> = ({ banners, siteSettings }) => {
    return (
        <SiteSettingsProvider settings={siteSettings}>
            <Hero banners={banners} />
        </SiteSettingsProvider>
    );
};

export default HomepageHero;
