import { Link } from '../App.tsx';
import { buttonClass } from '../components/ui.tsx';
import { useI18n } from '../i18n/index.tsx';

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <h1 className="text-3xl font-black">{t('notFound.title')}</h1>
      <Link href="/" className={buttonClass('primary', 'md')}>
        {t('notFound.home')}
      </Link>
    </div>
  );
}
