import ActivityLogsTable from '@/components/activity/ActivityLogsTable';

export const metadata = {
  title: 'Registro de Actividad - SPISA',
};

export default function ActivityPage() {
  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Registro de Actividad</h2>
      </div>
      <div className="hidden h-full flex-1 flex-col space-y-8 md:flex">
        <ActivityLogsTable />
      </div>
    </div>
  );
}


