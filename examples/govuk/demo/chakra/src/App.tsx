import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Code,
  Container,
  Dialog,
  Field,
  Flex,
  HStack,
  Heading,
  Input,
  Link,
  NativeSelect,
  Portal,
  RadioGroup,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Tooltip,
} from '@chakra-ui/react';
import ds from './ds.config';

// Every colour here is a role name: the compiled system registers each role as
// a Chakra colour palette, so `colorPalette="danger"` is the design system's danger.
const invoices = [
  { id: '#1042', customer: 'Globex', status: 'Paid', palette: 'success', amount: '$1,250.00' },
  { id: '#1043', customer: 'Initech', status: 'Pending', palette: 'warning', amount: '$840.50' },
  { id: '#1044', customer: 'Umbrella', status: 'Overdue', palette: 'danger', amount: '$2,310.00' },
  { id: '#1045', customer: 'Hooli', status: 'Draft', palette: 'neutral', amount: '$675.25' },
];

const alerts = [
  { status: 'info', title: 'Nightly sync scheduled for 02:00 UTC.' },
  { status: 'success', title: 'Report exported.' },
  { status: 'warning', title: 'Your plan renews in 3 days.' },
  { status: 'error', title: 'The last deploy failed.' },
] as const;

function SectionLabel({ children }: { children: string }) {
  return (
    <Heading as="h2" fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="0.08em" mb="3">
      {children}
    </Heading>
  );
}

export default function App() {
  const [mode, setMode] = useState<'light' | 'dark'>(ds.defaultMode);
  const [deleting, setDeleting] = useState(false);

  // Chakra's own scheme conditions: `.dark` on <html> switches every role.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  return (
    <Box minH="100vh" bg="bg" color="fg">
      {/* demo chrome (not part of the fake app) */}
      <Flex gap="3" px="4" py="1.5" align="center" borderBottomWidth="1px">
        <Text fontWeight="bold">transtyle demo · {ds.label}</Text>
        <Text color="fg.muted" fontSize="sm">
          @chakra-ui/react — real components, themed by the compiled createSystem config
        </Text>
        <Box flexGrow={1} />
        <Button variant="outline" size="xs" onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
          {mode === 'dark' ? '☀ light' : '☾ dark'}
        </Button>
      </Flex>

      {/* §1 Header */}
      <Box borderBottomWidth="1px">
        <Container maxW="960px" h="14">
          <Flex h="full" align="center" gap="6">
            <Text fontSize="lg" fontWeight="bold">
              Nimbus
            </Text>
            <HStack gap="3">
              <Link href="#" fontSize="sm" fontWeight="medium" colorPalette="primary">
                Dashboard
              </Link>
              <Link href="#" fontSize="sm" color="fg.muted">
                Reports
              </Link>
              <Link href="#" fontSize="sm" color="fg.muted">
                Settings
              </Link>
            </HStack>
            <Box flexGrow={1} />
            <Button colorPalette="primary">New report</Button>
          </Flex>
        </Container>
      </Box>

      <Container maxW="960px" py="8">
        {/* §2 Buttons */}
        <Box mb="8">
          <SectionLabel>2 · Buttons</SectionLabel>
          <HStack gap="2" wrap="wrap">
            <Button colorPalette="primary">Default</Button>
            <Button colorPalette="secondary">Secondary</Button>
            <Button colorPalette="danger">Destructive</Button>
            <Button colorPalette="primary" variant="outline">
              Outline
            </Button>
            <Button colorPalette="primary" variant="ghost">
              Ghost
            </Button>
            <Button colorPalette="primary" variant="subtle">
              Soft
            </Button>
            <Button colorPalette="primary" disabled>
              Disabled
            </Button>
            {/* component.tooltip.max-width: long text on purpose, a max-width is
                only observable when the content wants to exceed it. Acme authors
                the slot, so its tooltip wraps at 18rem; the others keep Chakra's. */}
            <Tooltip.Root openDelay={100}>
              <Tooltip.Trigger asChild>
                <Button colorPalette="primary" variant="outline">
                  Hover me
                </Button>
              </Tooltip.Trigger>
              <Portal>
                <Tooltip.Positioner>
                  <Tooltip.Content>
                    This tooltip wraps at the design system's own measure, not the component library's default — one
                    authored token, honored by every target that has the slot.
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Portal>
            </Tooltip.Root>
          </HStack>
          <HStack gap="2" mt="3">
            <Badge colorPalette="primary" variant="solid">
              Badge
            </Badge>
            <Badge colorPalette="secondary" variant="solid">
              Secondary
            </Badge>
            <Badge colorPalette="danger" variant="solid">
              Destructive
            </Badge>
            <Badge colorPalette="primary" variant="outline">
              Outline
            </Badge>
          </HStack>
          <Stack gap="2" mt="4">
            {alerts.map((a) => (
              <Alert.Root key={a.status} status={a.status}>
                <Alert.Indicator />
                <Alert.Title>{a.title}</Alert.Title>
              </Alert.Root>
            ))}
          </Stack>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap="8" mb="8">
          {/* §3 Form */}
          <Box>
            <SectionLabel>3 · Form</SectionLabel>
            <Stack as="form" gap="4">
              <Field.Root>
                <Field.Label>Project name</Field.Label>
                <Input placeholder="e.g. apollo-11" colorPalette="primary" />
                <Field.HelperText>Lowercase letters and dashes only.</Field.HelperText>
              </Field.Root>
              <Field.Root invalid>
                <Field.Label>Owner email</Field.Label>
                <Input defaultValue="not-an-email" />
                <Field.ErrorText>That doesn't look like an email address.</Field.ErrorText>
              </Field.Root>
              <Field.Root>
                <Field.Label>Region</Field.Label>
                <NativeSelect.Root>
                  <NativeSelect.Field defaultValue="eu-west">
                    <option value="eu-west">eu-west</option>
                    <option value="us-east">us-east</option>
                    <option value="ap-south">ap-south</option>
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
              </Field.Root>
              <Checkbox.Root defaultChecked colorPalette="primary">
                <Checkbox.HiddenInput />
                <Checkbox.Control />
                <Checkbox.Label>Email me weekly updates</Checkbox.Label>
              </Checkbox.Root>
              <RadioGroup.Root defaultValue="starter" colorPalette="primary">
                <HStack gap="6">
                  <RadioGroup.Item value="starter">
                    <RadioGroup.ItemHiddenInput />
                    <RadioGroup.ItemIndicator />
                    <RadioGroup.ItemText>Starter plan</RadioGroup.ItemText>
                  </RadioGroup.Item>
                  <RadioGroup.Item value="pro">
                    <RadioGroup.ItemHiddenInput />
                    <RadioGroup.ItemIndicator />
                    <RadioGroup.ItemText>Pro plan</RadioGroup.ItemText>
                  </RadioGroup.Item>
                </HStack>
              </RadioGroup.Root>
              <Switch.Root defaultChecked colorPalette="primary">
                <Switch.HiddenInput />
                <Switch.Control />
                <Switch.Label>Enable usage alerts</Switch.Label>
              </Switch.Root>
              <HStack gap="2">
                <Button type="button" colorPalette="primary">
                  Save changes
                </Button>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </HStack>
            </Stack>
          </Box>

          {/* §4 Card */}
          <Box>
            <SectionLabel>4 · Card</SectionLabel>
            <Card.Root>
              <Card.Body gap="1">
                <Card.Title>Q2 growth report</Card.Title>
                <Card.Description>Generated 3 minutes ago</Card.Description>
                <Text mt="2">
                  Revenue grew 18% quarter-over-quarter. The forecast pipeline is refreshed nightly by the{' '}
                  <Code>nightly-sync</Code> job; see the{' '}
                  <Link href="#" colorPalette="primary" variant="underline">
                    full methodology
                  </Link>{' '}
                  for caveats.
                </Text>
              </Card.Body>
              <Card.Footer gap="2">
                <Button size="xs" colorPalette="primary">
                  Share
                </Button>
                <Button size="xs" variant="outline">
                  Export PDF
                </Button>
              </Card.Footer>
            </Card.Root>
          </Box>
        </SimpleGrid>

        {/* §5 Table */}
        <Box mb="8">
          <SectionLabel>5 · Table</SectionLabel>
          <Table.Root interactive>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Invoice</Table.ColumnHeader>
                <Table.ColumnHeader>Customer</Table.ColumnHeader>
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Amount</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {invoices.map((row) => (
                <Table.Row key={row.id}>
                  <Table.Cell fontWeight="medium">{row.id}</Table.Cell>
                  <Table.Cell>{row.customer}</Table.Cell>
                  <Table.Cell>
                    <Badge colorPalette={row.palette}>{row.status}</Badge>
                  </Table.Cell>
                  <Table.Cell textAlign="end">{row.amount}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>

        {/* §6 Modal */}
        <Box mb="8">
          <SectionLabel>6 · Modal</SectionLabel>
          <Dialog.Root open={deleting} onOpenChange={(e) => setDeleting(e.open)} placement="center">
            <Dialog.Trigger asChild>
              <Button colorPalette="danger">Delete workspace…</Button>
            </Dialog.Trigger>
            <Portal>
              <Dialog.Backdrop />
              <Dialog.Positioner>
                <Dialog.Content>
                  <Dialog.Header>
                    <Dialog.Title>Delete workspace?</Dialog.Title>
                  </Dialog.Header>
                  <Dialog.Body>
                    <Text fontSize="sm">
                      This permanently deletes <b>nimbus/production</b> and all its reports. This action cannot be
                      undone.
                    </Text>
                  </Dialog.Body>
                  <Dialog.Footer>
                    <Button variant="outline" onClick={() => setDeleting(false)}>
                      Cancel
                    </Button>
                    <Button colorPalette="danger" onClick={() => setDeleting(false)}>
                      Delete workspace
                    </Button>
                  </Dialog.Footer>
                </Dialog.Content>
              </Dialog.Positioner>
            </Portal>
          </Dialog.Root>
        </Box>
      </Container>
    </Box>
  );
}
