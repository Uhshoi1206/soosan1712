/**
 * HomepageFooter - Footer with ScrollToTop and Toaster
 * Should be loaded with client:idle for deferred loading
 */
import React from 'react';
import { SiteSettingsProvider } from '@/contexts/SiteSettingsContext';
import Footer from '../Footer';
import ScrollToTop from '../ScrollToTop';
import { Toaster } from '../ui/toaster';
import type { SiteSettings } from '@/types/siteSettings';

interface HomepageFooterProps {
    siteSettings?: Partial<SiteSettings>;
}

const HomepageFooter: React.FC<HomepageFooterProps> = ({ siteSettings }) => {
    return (
        <SiteSettingsProvider settings={siteSettings}>
            <Footer />
            <ScrollToTop />
            <Toaster />
        </SiteSettingsProvider>
    );
};

export default HomepageFooter;
