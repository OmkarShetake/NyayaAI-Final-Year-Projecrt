import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FolderPlus, Plus } from 'lucide-react';
import { caseService } from '../services/caseService';
import { useAsync } from '../hooks/useAsync';
import { useDebounce } from '../hooks/useDebounce';
import { AsyncBoundary, EmptyState } from '../components/common/Feedback';
import { PageHeader } from '../components/common/UI';
import CaseFilters, { EMPTY_CASE_FILTERS } from '../components/cases/CaseFilters';
import CaseTable from '../components/cases/CaseTable';
import Pagination from '../components/common/Pagination';
import ConfirmDialog from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

export default function Cases() {
  const { canEdit } = useAuth();
  const [filters, setFilters] = useState(EMPTY_CASE_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const search = useDebounce(filters.search);
  const params = { ...filters, search, page, limit };

  const { data, loading, error, refetch } = useAsync(() => caseService.list(params), [JSON.stringify(params)]);

  const updateFilters = (f) => { setFilters(f); setPage(1); };
  const updateLimit = (l) => { setLimit(l); setPage(1); };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await caseService.remove(toDelete._id);
      toast.success(`Deleted ${toDelete.caseNumber}`);
      setToDelete(null);
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const pagination = data?._meta?.pagination;
  return (
    <>
      <PageHeader
        eyebrow="Case management"
        title="Cases"
        subtitle="Search, filter and manage registered cases."
        actions={canEdit && <Link to="/cases/new" className="btn-primary"><Plus className="h-4 w-4" /> New case</Link>}
      />
      <CaseFilters value={filters} onChange={updateFilters} />
      <div className="card overflow-hidden">
        <AsyncBoundary
          loading={loading && !data}
          error={error}
          onRetry={refetch}
          isEmpty={!data?.cases?.length}
          empty={<EmptyState icon={FolderPlus} title="No cases found" message="Try adjusting the filters, or register a new case." action={canEdit && <Link to="/cases/new" className="btn-primary">Create case</Link>} />}
        >
          <div className={loading ? 'opacity-60' : ''}>
            <CaseTable cases={data?.cases || []} onDelete={setToDelete} />
            <Pagination
              page={pagination?.page}
              totalPages={pagination?.totalPages}
              total={pagination?.total}
              limit={limit}
              onLimitChange={updateLimit}
              onChange={setPage}
            />
          </div>
        </AsyncBoundary>
      </div>
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete case?"
        message={`${toDelete?.caseNumber} and its predictions, similar-case links and recommendations will be permanently removed.`}
        confirmLabel="Delete"
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
