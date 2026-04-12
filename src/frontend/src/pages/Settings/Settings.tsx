import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useLocation, useNavigate } from 'react-router-dom';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import PeopleIcon from '@mui/icons-material/People';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...props }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...props}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
};

const a11yProps = (index: number) => {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
};

const Settings: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated: _isAuthenticated, user: _user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine initial tab based on URL path
  const getInitialTab = () => {
    const path = location.pathname;
    if (path.includes('/api')) return 1;
    if (path.includes('/advanced')) return 2;
    return 0; // Default to general tab
  };

  const [tabValue, setTabValue] = useState(getInitialTab());

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    if (newValue === 0) navigate('/settings');
    else if (newValue === 1) navigate('/settings/api');
    else if (newValue === 2) navigate('/settings/advanced');
    else if (newValue === 3) navigate('/settings/users');
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Configure your application preferences and API credentials.
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
          <Tab label="General" {...a11yProps(0)} />
          <Tab label="API Keys" {...a11yProps(1)} />
          <Tab label="Advanced" {...a11yProps(2)} />
          <Tab
            label="User Management"
            icon={<PeopleIcon />}
            iconPosition="start"
            {...a11yProps(3)}
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        <Typography variant="h5" component="h2" gutterBottom>
          General Settings
        </Typography>
        
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" component="h3" gutterBottom>
              Appearance
            </Typography>
            
            <List>
              <ListItem>
                <ListItemIcon>
                  {theme === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
                </ListItemIcon>
                <ListItemText 
                  primary="Dark Mode" 
                  secondary="Switch between light and dark interface themes"
                />
                <Switch 
                  checked={theme === 'dark'} 
                  onChange={toggleTheme} 
                  color="primary" 
                  inputProps={{ 'aria-label': 'toggle dark mode' }}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" component="h3" gutterBottom>
              API Configuration
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              API credentials are managed on the server. This client does not store or edit provider keys.
            </Typography>

            <Alert severity="info">
              Configure OpenAI and other provider secrets through backend environment variables or your deployment
              platform&apos;s secret manager. Do not place API keys in browser settings, client-side env vars, or
              local storage.
            </Alert>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Typography variant="h5" component="h2" gutterBottom>
          API Keys
        </Typography>
        
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" component="h3" gutterBottom>
              OpenAI API Keys
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Configure your API keys for enhanced features.
            </Typography>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Typography variant="h5" component="h2" gutterBottom>
          Advanced Settings
        </Typography>
        
        <Card variant="outlined" sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" component="h3" gutterBottom>
              AI Model Configuration
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel id="default-ai-model-label">Default AI Model</InputLabel>
                  <Select
                    labelId="default-ai-model-label"
                    id="default-ai-model-select"
                    defaultValue="gpt-4.1"
                    label="Default AI Model"
                    aria-labelledby="default-ai-model-label"
                  >
                    <MenuItem value="gpt-4.1">GPT-4.1 (Recommended)</MenuItem>
                    <MenuItem value="gpt-4.1-nano">GPT-4.1 Nano (Faster)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <TextField
                  label="Model Temperature"
                  type="number"
                  defaultValue={0.7}
                  InputProps={{
                    inputProps: { 
                      min: 0, 
                      max: 1, 
                      step: 0.1,
                      'aria-label': 'Model Temperature'
                    },
                  }}
                  fullWidth
                  helperText="Controls randomness: 0 is deterministic, 1 is creative"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
        
        <Card variant="outlined">
          <CardContent>
            <Typography variant="h6" component="h3" gutterBottom>
              Script Generation Settings
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch 
                      defaultChecked 
                      color="primary" 
                      inputProps={{ 'aria-label': 'include comments switch' }}
                    />
                  }
                  label="Include comments in generated scripts"
                />
              </Grid>
              
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch 
                      defaultChecked 
                      color="primary" 
                      inputProps={{ 'aria-label': 'auto-format code switch' }}
                    />
                  }
                  label="Auto-format generated code"
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </TabPanel>
    </Container>
  );
};

export default Settings;
