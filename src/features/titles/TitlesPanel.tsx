/**
 * Titles screen: the full catalog of achievable academic titles (earned ✓ /
 * locked with progress + tips, the hidden "???" one) and the place to equip the
 * one shown on the student's profile card. Titles are per-student (global across
 * courses), so this loads once with no course context.
 */
import React, { useEffect, useState } from 'react';
import { Crown, Loader2 } from 'lucide-react';
import { apiClient, type TitleDto } from '../../lib/api-client';
import { useTranslations } from '../../i18n';
import TitlesShowcase from '../gamification/TitlesShowcase';

export default function TitlesPanel() {
  const t = useTranslations('titlesPanel');
  const [titles, setTitles] = useState<TitleDto[]>([]);
  const [displayed, setDisplayed] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getTitles()
      .then((res) => {
        if (!cancelled && res) {
          setTitles(res.titles);
          setDisplayed(res.displayed);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEquip = async (key: string | null) => {
    setEquipping(key);
    try {
      const res = await apiClient.equipTitle(key);
      setDisplayed(res.displayed);
    } catch {
      /* only earned titles can be equipped — ignore */
    } finally {
      setEquipping(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#5e17eb] to-[#5ce1e6] text-white shadow-lg shadow-[#5e17eb]/25">
          <Crown className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <TitlesShowcase
          titles={titles}
          displayed={displayed}
          equipping={equipping}
          onEquip={handleEquip}
        />
      )}
    </div>
  );
}
