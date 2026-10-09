import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Checkbox,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import ds from './ds.config';

// Every colour here is a role name: the compiled theme registers each role as
// a palette key (`danger` is MUI's `error`), so `color="error"` is the design
// system's danger and `color="neutral"` its neutral grid.
const invoices = [
  { id: '#1042', customer: 'Globex', status: 'Paid', color: 'success', amount: '$1,250.00' },
  { id: '#1043', customer: 'Initech', status: 'Pending', color: 'warning', amount: '$840.50' },
  { id: '#1044', customer: 'Umbrella', status: 'Overdue', color: 'error', amount: '$2,310.00' },
  { id: '#1045', customer: 'Hooli', status: 'Draft', color: 'neutral', amount: '$675.25' },
] as const;

const alerts = [
  { severity: 'info', title: 'Nightly sync scheduled for 02:00 UTC.' },
  { severity: 'success', title: 'Report exported.' },
  { severity: 'warning', title: 'Your plan renews in 3 days.' },
  { severity: 'error', title: 'The last deploy failed.' },
] as const;

function SectionLabel({ children }: { children: string }) {
  return (
    <Typography
      component="h2"
      variant="overline"
      color="text.secondary"
      sx={{ display: 'block', mb: 1.5, letterSpacing: '0.08em' }}
    >
      {children}
    </Typography>
  );
}

export default function App() {
  // MUI's own scheme mechanism: setMode() swaps the [data-color-scheme] attribute.
  const { mode: muiMode, setMode } = useColorScheme();
  const mode = (muiMode === 'system' || !muiMode ? ds.defaultMode : muiMode) as 'light' | 'dark';
  const [deleting, setDeleting] = useState(false);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', color: 'text.primary' }}>
      {/* demo chrome (not part of the fake app) */}
      <Stack direction="row" spacing={1.5} sx={{ px: 2, py: 0.75, alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 700 }}>transtyle demo · {ds.label}</Typography>
        <Typography variant="body2" color="text.secondary">
          @mui/material — real components, themed by the compiled createTheme options
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" size="small" color="neutral" onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
          {mode === 'dark' ? '☀ light' : '☾ dark'}
        </Button>
      </Stack>

      {/* §1 Header */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth={false} sx={{ maxWidth: 960, height: 56 }}>
          <Stack direction="row" spacing={3} sx={{ height: '100%', alignItems: 'center' }}>
            <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
              Nimbus
            </Typography>
            <Stack direction="row" spacing={1.5}>
              <Link href="#" variant="body2" underline="hover" sx={{ fontWeight: 500 }}>
                Dashboard
              </Link>
              <Link href="#" variant="body2" underline="hover" color="text.secondary">
                Reports
              </Link>
              <Link href="#" variant="body2" underline="hover" color="text.secondary">
                Settings
              </Link>
            </Stack>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="contained">New report</Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth={false} sx={{ maxWidth: 960, py: 4 }}>
        {/* §2 Buttons */}
        <Box sx={{ mb: 4 }}>
          <SectionLabel>2 · Buttons</SectionLabel>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button variant="contained">Default</Button>
            <Button variant="contained" color="secondary">
              Secondary
            </Button>
            <Button variant="contained" color="error">
              Destructive
            </Button>
            <Button variant="outlined">Outline</Button>
            <Button variant="text">Ghost</Button>
            <Button variant="contained" color="accent">
              Accent
            </Button>
            <Button variant="contained" disabled>
              Disabled
            </Button>
            {/* component.tooltip.max-width: long text on purpose, a max-width is
                only observable when the content wants to exceed it. Acme authors
                the slot, so its tooltip wraps at 18rem; the others keep MUI's. */}
            <Tooltip
              enterDelay={100}
              title="This tooltip wraps at the design system's own measure, not the component library's default — one authored token, honored by every target that has the slot."
            >
              <Button variant="outlined">Hover me</Button>
            </Tooltip>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Chip label="Badge" color="primary" size="small" />
            <Chip label="Secondary" color="secondary" size="small" />
            <Chip label="Destructive" color="error" size="small" />
            <Chip label="Outline" color="primary" variant="outlined" size="small" />
          </Stack>
          <Stack spacing={1} sx={{ mt: 2 }}>
            {alerts.map((a) => (
              <Alert key={a.severity} severity={a.severity}>
                {a.title}
              </Alert>
            ))}
          </Stack>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, mb: 4 }}>
          {/* §3 Form */}
          <Box>
            <SectionLabel>3 · Form</SectionLabel>
            <Stack component="form" spacing={2}>
              <TextField label="Project name" placeholder="e.g. apollo-11" helperText="Lowercase letters and dashes only." />
              <TextField label="Owner email" defaultValue="not-an-email" error helperText="That doesn't look like an email address." />
              <TextField select label="Region" defaultValue="eu-west">
                <MenuItem value="eu-west">eu-west</MenuItem>
                <MenuItem value="us-east">us-east</MenuItem>
                <MenuItem value="ap-south">ap-south</MenuItem>
              </TextField>
              <FormControlLabel control={<Checkbox defaultChecked />} label="Email me weekly updates" />
              <RadioGroup row defaultValue="starter" name="plan">
                <FormControlLabel value="starter" control={<Radio />} label="Starter plan" />
                <FormControlLabel value="pro" control={<Radio />} label="Pro plan" />
              </RadioGroup>
              <FormControlLabel control={<Switch defaultChecked />} label="Enable usage alerts" />
              <Stack direction="row" spacing={1}>
                <Button type="button" variant="contained">
                  Save changes
                </Button>
                <Button type="button" variant="outlined" color="neutral">
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </Box>

          {/* §4 Card */}
          <Box>
            <SectionLabel>4 · Card</SectionLabel>
            <Card>
              <CardContent>
                <Typography variant="h6" component="h3">
                  Q2 growth report
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Generated 3 minutes ago
                </Typography>
                <Typography sx={{ mt: 1 }}>
                  Revenue grew 18% quarter-over-quarter. The forecast pipeline is refreshed nightly by the{' '}
                  <Box component="code" sx={{ fontFamily: 'monospace', fontSize: '0.875em' }}>
                    nightly-sync
                  </Box>{' '}
                  job; see the <Link href="#">full methodology</Link> for caveats.
                </Typography>
              </CardContent>
              <CardActions>
                <Button size="small" variant="contained">
                  Share
                </Button>
                <Button size="small" variant="outlined" color="neutral">
                  Export PDF
                </Button>
              </CardActions>
            </Card>
          </Box>
        </Box>

        {/* §5 Table */}
        <Box sx={{ mb: 4 }}>
          <SectionLabel>5 · Table</SectionLabel>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{row.id}</TableCell>
                  <TableCell>{row.customer}</TableCell>
                  <TableCell>
                    <Chip label={row.status} color={row.color} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">{row.amount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>

        {/* §6 Modal */}
        <Box sx={{ mb: 4 }}>
          <SectionLabel>6 · Modal</SectionLabel>
          <Button variant="contained" color="error" onClick={() => setDeleting(true)}>
            Delete workspace…
          </Button>
          <Dialog open={deleting} onClose={() => setDeleting(false)}>
            <DialogTitle>Delete workspace?</DialogTitle>
            <DialogContent>
              <DialogContentText>
                This permanently deletes <b>nimbus/production</b> and all its reports. This action cannot be undone.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button variant="outlined" color="neutral" onClick={() => setDeleting(false)}>
                Cancel
              </Button>
              <Button variant="contained" color="error" onClick={() => setDeleting(false)}>
                Delete workspace
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Container>
    </Box>
  );
}
