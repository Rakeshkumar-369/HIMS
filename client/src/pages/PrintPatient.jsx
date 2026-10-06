import { useParams } from 'react-router-dom';
import { useFetch } from '../lib/hooks';
import { PageLoader } from '../components/ui';
import CaseSheet from '../components/CaseSheet';
import PrintFrame from '../components/PrintFrame';

export default function PrintPatient() {
  const { id } = useParams();
  const { data, error } = useFetch(`/patients/${id}`, [id]);
  if (error) return <p className="p-10 text-center text-rose-600">{error.message}</p>;
  if (!data) return <PageLoader />;
  const visits = data.visits.filter((v) => v.status === 'completed').map(({ doctor_comment, ...v }) => v); // eslint-disable-line no-unused-vars
  return (
    <PrintFrame title={`${data.patient.full_name} · complete case record`} filename={`CaseRecord-${data.patient.case_no}`}>
      <CaseSheet full clinic={data.clinic} patient={data.patient} visits={visits} />
    </PrintFrame>
  );
}
