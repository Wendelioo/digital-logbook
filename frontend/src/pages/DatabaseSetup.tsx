import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import Button from '../components/Button';
import { AlertCircle, CheckCircle2, Database, Server } from 'lucide-react';
import { GetCurrentDatabaseSettings, TestDatabaseConnection, UpdateDatabaseConnection } from '../../wailsjs/go/main/App';

interface DatabaseSettings {
  server: string;
  port: string;
  username: string;
  password: string;
  database: string;
  instance: string;
}

export default function DatabaseSetupPage() {
  const [settings, setSettings] = useState<DatabaseSettings>({
    server: '192.168.1.200',
    port: '1433',
    username: 'logbook_app',
    password: '',
    database: 'logbookdb',
    instance: '',
  });

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    try {
      const current = await GetCurrentDatabaseSettings();
      setSettings(current);
    } catch (error) {
      console.error('Failed to load database settings:', error);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      await TestDatabaseConnection(settings);
      setTestResult({ success: true, message: 'Connection successful!' });
    } catch (error: any) {
      setTestResult({ 
        success: false, 
        message: error?.message || 'Connection failed. Please check your settings.' 
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);

    try {
      await UpdateDatabaseConnection(settings);
      setTestResult({ success: true, message: 'Database configuration saved successfully!' });
    } catch (error: any) {
      setTestResult({ 
        success: false, 
        message: error?.message || 'Failed to save configuration.' 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof DatabaseSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <Database className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Database Configuration</h1>
          <p className="text-gray-600">
            Configure the connection to your SQL Server database
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Server Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={settings.server}
                  onChange={(e) => handleChange('server', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="192.168.1.200 or localhost"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                IP address or hostname of your SQL Server
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Port
                </label>
                <input
                  type="text"
                  value={settings.port}
                  onChange={(e) => handleChange('port', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="1433"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instance (optional)
                </label>
                <input
                  type="text"
                  value={settings.instance}
                  onChange={(e) => handleChange('instance', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="SQLEXPRESS"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Database Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={settings.database}
                onChange={(e) => handleChange('database', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="logbookdb"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={settings.username}
                onChange={(e) => handleChange('username', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="logbook_app"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={settings.password}
                onChange={(e) => handleChange('password', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter database password"
                required
              />
            </div>

            {testResult && (
              <div
                className={`flex items-start gap-3 p-4 rounded-lg ${
                  testResult.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      testResult.success ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    {testResult.message}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                onClick={handleTest}
                disabled={testing || saving}
                variant="outline"
                className="flex-1"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={testing || saving || !settings.server || !settings.username || !settings.password}
                className="flex-1"
              >
                {saving ? 'Saving...' : 'Save & Connect'}
              </Button>
            </div>
          </form>
        </Card>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">💡 Connection Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Make sure the SQL Server is accessible from this computer</li>
            <li>• Check firewall settings if connection fails</li>
            <li>• For SQL Server Express, use instance name (e.g., SQLEXPRESS)</li>
            <li>• Contact your IT admin if you don't have database credentials</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
