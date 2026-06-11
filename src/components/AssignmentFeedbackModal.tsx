'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, ClipboardList, Upload, Loader2, Calendar, ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useTranslations } from '@/i18n';

interface Assignment {
  id: number;
  title: string;
  description?: string;
  due_date: string;
  original_file_name: string;
  file_size_bytes: number;
  content_type: string;
}

interface AssignmentFeedbackModalProps {
  moduleToken: string;
  verificationToken?: string;
  studentId?: string;
  conversationId?: string;
  moduleId?: number;
  apiBaseUrl?: string;
  onClose: () => void;
  onFeedbackReceived: (response: string, conversationId: string) => void;
  /**
   * Companion-widget background mode: submit asynchronously and return
   * immediately with the job info instead of waiting for the AI response.
   * When set, onFeedbackReceived is NOT called.
   */
  onJobStarted?: (job: {
    submissionId: number;
    conversationId: string;
    assignmentTitle: string;
  }) => void;
}

type Step = 'select' | 'upload' | 'loading';

export default function AssignmentFeedbackModal({
  moduleToken,
  verificationToken,
  studentId,
  conversationId,
  moduleId,
  onClose,
  onFeedbackReceived,
  onJobStarted,
}: AssignmentFeedbackModalProps) {
  const t = useTranslations('feedbackModal');
  const [step, setStep] = useState<Step>('select');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiClient.getAssignments(moduleToken, moduleId);
        setAssignments(data);
      } catch (err) {
        setErrorMsg(t('loadError'));
      } finally {
        setLoadingAssignments(false);
      }
    };
    load();
  }, [moduleToken, moduleId]);

  const handleSelectAssignment = (a: Assignment) => {
    setSelectedAssignment(a);
    setSelectedFile(null);
    setErrorMsg(null);
    setStep('upload');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > 20 * 1024 * 1024) {
      setErrorMsg(t('fileTooLarge'));
      return;
    }
    setErrorMsg(null);
    setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedAssignment || !selectedFile) return;
    setStep('loading');
    setErrorMsg(null);
    try {
      if (onJobStarted) {
        // Background mode: enqueue and hand the job back immediately
        const job = await apiClient.submitAssignmentFeedbackAsync({
          moduleToken,
          assignmentId: selectedAssignment.id,
          file: selectedFile,
          conversationId,
          moduleId,
        });
        onJobStarted({
          submissionId: job.submission_id,
          conversationId: job.conversation_id,
          assignmentTitle: selectedAssignment.title,
        });
        onClose();
        return;
      }

      const result = await apiClient.submitAssignmentFeedback({
        moduleToken,
        assignmentId: selectedAssignment.id,
        file: selectedFile,
        studentId,
        conversationId,
        moduleId,
        verificationToken,
      });
      onFeedbackReceived(result.response, result.conversation_id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('submitError');
      setErrorMsg(msg);
      setStep('upload');
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const isPastDue = (iso: string) => new Date(iso) < new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-background rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            {step === 'upload' && (
              <button onClick={() => setStep('select')} className="text-muted-foreground hover:text-foreground mr-1">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <ClipboardList className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">
              {step === 'select' ? t('selectTitle') : step === 'upload' ? t('uploadTitle') : t('analyzingTitle')}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('analyzingBody')}</p>
              <p className="text-xs text-muted-foreground">{t('analyzingHint')}</p>
            </div>
          )}

          {step === 'select' && (
            <>
              {loadingAssignments ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : assignments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t('empty')}</p>
              ) : (
                <div className="space-y-3">
                  {assignments.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => handleSelectAssignment(a)}
                      className="w-full text-left p-4 border rounded-xl hover:border-primary hover:bg-muted/50 transition-colors"
                    >
                      <p className="font-medium text-sm">{a.title}</p>
                      {a.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>
                      )}
                      <div className="flex items-center gap-1 mt-2">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className={`text-xs ${isPastDue(a.due_date) ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                          {t('due', { date: formatDate(a.due_date) })}{isPastDue(a.due_date) ? ` ${t('expired')}` : ''}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {errorMsg && <p className="text-xs text-destructive mt-3">{errorMsg}</p>}
            </>
          )}

          {step === 'upload' && selectedAssignment && (
            <div className="space-y-4">
              <div className="p-3 border rounded-lg bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground mb-0.5">{t('selectedAssignment')}</p>
                <p className="font-medium text-sm">{selectedAssignment.title}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  <span className={`text-xs ${isPastDue(selectedAssignment.due_date) ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {t('due', { date: formatDate(selectedAssignment.due_date) })}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">{t('uploadLabel')}</p>
                <p className="text-xs text-muted-foreground mb-3">{t('uploadHint')}</p>
                <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary hover:bg-muted/30 transition-colors">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {selectedFile ? selectedFile.name : t('selectFile')}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

              <Button
                className="w-full"
                disabled={!selectedFile}
                onClick={handleSubmit}
              >
                {t('submit')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
