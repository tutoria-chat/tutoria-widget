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
      <h2 className="text-xl font-semibold text-foreground">{t('title')}</h2>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{t('subtitle')}</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : files.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">{t('empty')}</p>
      ) : (
        <div className="grid gap-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between p-3 rounded-md bg-background border"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground uppercase">{file.file_type}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                disabled={downloadingId === file.id}
                onClick={() => handleDownload(file)}
              >
                {downloadingId === file.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
