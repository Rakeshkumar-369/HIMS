import { useParams } from 'react-router-dom';
import { useFetch } from '../lib/hooks';
import { PageLoader } from '../components/ui';
import CaseSheet from '../components/CaseSheet';
import PrintFrame from '../components/PrintFrame';

export default function PrintVisit() {
  const { id } = useParams();
  const { data, error } = useFetch(`/visits/${id}`);
  if (error) return <p className="p-10 text-center text-rose-600">{error.message}</p>;
  if (!data) return <PageLoader />;
  const { visit, patient, clinic } = data;
  const { doctor_comment, ...safe } = visit;
  return (
    <PrintFrame title={`${patient.full_name} · ${visit.visit_date}`} filename={`CaseSheet-${patient.case_no}-${visit.visit_date}`} autoPrint>
      <CaseSheet clinic={clinic} patient={patient} visits={[safe]} />
    </PrintFrame>
  );
}
