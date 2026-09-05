/**
 * Files panel: course materials for the active module.
 *
 * Downloads for a non-default module require the session Authorization header,
 * so files are fetched as blobs instead of plain <a href> navigation.
 */
import React, { useEffect, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { apiClient, robustFetch } from '../../lib/api-client';
import { useApp } from '../../app/AppContext';
import { useTranslations } from '../../i18n';

interface WidgetFile {
  id: number;
  name: string;
  file_type: string;
  download_url: string;
}

export default function FilesPanel({ apiBaseUrl }: { apiBaseUrl: string }) {
  const t = useTranslations('files');
  const tCommon = useTranslations('common');
  const { moduleToken, session, activeModuleId } = useApp();

  const [files, setFiles] = useState<WidgetFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const isDefaultModule = activeModuleId === session.default_module_id;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiClient
      .getModuleFiles(moduleToken, isDefaultModule ? undefined : activeModuleId)
      .then((data) => {
        if (!cancelled) setFiles(data);
      })
      .catch(() => {
        if (!cancelled) setError(t('loadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [moduleToken, activeModuleId, isDefaultModule]);

  const handleDownload = async (file: WidgetFile) => {
    setDownloadingId(file.id);
    try {
      // download_url is relative and already carries module_token (+ module_id when switched)
      const response = await robustFetch(`${apiBaseUrl}${file.download_url}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.session_token}` },
        timeout: 60000,
        retries: 1,
      });
      if (!response.ok) throw new Error(`download failed: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('loadError'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#5e17eb] to-[#5ce1e6] text-white shadow-lg shadow-[#5e17eb]/25">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div role="status" className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">{tCommon('loading')}</span>
        </div>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t('empty')}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {files.map((file) => (
            <button
              key={file.id}
              disabled={downloadingId === file.id}
              onClick={() => handleDownload(file)}
              className="group flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold transition-colors group-hover:text-primary">
                    {file.name}
                  </p>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{file.file_type}</p>
                </div>
              </div>
              {downloadingId === file.id ? (
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
              ) : (
                <Download className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
