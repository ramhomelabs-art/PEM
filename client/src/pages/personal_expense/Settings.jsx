import { Panel, Button, IconBadge } from '../../components/ui/primitives';
import { Settings as SettingsIcon, Shield, Server, User, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Settings = () => {
  const navigate = useNavigate();
  return (
    <div className='min-h-screen p-10 text-ink'>
      <header className='mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between'>
        <div>
          <h2 className='text-2xl font-black tracking-tight text-ink sm:text-3xl'>Settings</h2>
          <p className='mt-1 text-sm text-ink-muted'>Manage preferences and system configuration</p>
        </div>
      </header>
      <div className='grid gap-6 md:grid-cols-2'>
        <Panel>
          <h3 className='mb-4 flex items-center gap-2 text-sm font-bold text-ink'>
            <IconBadge icon={User} tone='brand' size='sm' />
            User Profile
          </h3>
          <p className='mb-4 text-sm text-ink-muted'>Update your personal information.</p>
          <Button variant='primary' onClick={() => navigate('/profile')}>
            Manage Profile
          </Button>
        </Panel>
        <Panel>
          <h3 className='mb-4 flex items-center gap-2 text-sm font-bold text-ink'>
            <IconBadge icon={Shield} tone='violet' size='sm' />
            Security & MFA
          </h3>
          <p className='mb-4 text-sm text-ink-muted'>Manage MFA and security settings.</p>
          <Button onClick={() => navigate('/admin/mfa')}>
            MFA Manager
          </Button>
        </Panel>
        <Panel>
          <h3 className='mb-4 flex items-center gap-2 text-sm font-bold text-ink'>
            <IconBadge icon={Server} tone='warn' size='sm' />
            Server Management
          </h3>
          <p className='mb-4 text-sm text-ink-muted'>Monitor server status and logs.</p>
          <Button onClick={() => navigate('/admin/server-manager')}>
            Manage Server
          </Button>
        </Panel>
      </div>
    </div>
  );
};

export default Settings;
