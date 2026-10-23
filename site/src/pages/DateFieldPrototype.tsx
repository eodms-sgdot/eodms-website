import { useContext, useState } from 'react';
import { Alert, Box, Button, Container, Stack, Typography } from '@mui/material';
import { AppContext } from '../AppContext';
import DatePicker from '../components/datepicker/DatePicker';
import { readDateParts } from '../utils/PartialDates';

export default function DateFieldPrototype() {
    const { language, setLanguage, displayMode, setDisplayMode } = useContext(AppContext)!;
    const [temporal, setTemporal] = useState('custom');
    const [start, setStart] = useState('');
    const [end, setEnd] = useState('');
    return (
        <Container maxWidth="sm" sx={{ py: 4 }}>
            <Stack spacing={2}>
                <Typography variant="h5">React Aria — {language === 'fr' ? 'Prototype de dates' : 'Date prototype'}</Typography>
                <Alert severity="info">
                    {language === 'fr' ? 'Contrôle partagé avec la recherche. Cette page ne lance aucune requête et ne sauvegarde pas les dates.'
                        : 'Shared search control. This page makes no search requests and does not persist dates.'}
                </Alert>
                <Stack direction="row" spacing={1}>
                    <Button onClick={() => setLanguage(language === 'en' ? 'fr' : 'en')}>EN / FR</Button>
                    <Button onClick={() => setDisplayMode(displayMode === 'light' ? 'dark' : 'light')}>
                        {language === 'fr' ? 'Clair / sombre' : 'Light / dark'}
                    </Button>
                    <Button onClick={() => { setStart(''); setEnd(''); setTemporal('custom'); }}>
                        {language === 'fr' ? 'Réinitialiser' : 'Reset'}
                    </Button>
                </Stack>
                <DatePicker searchTemporal={temporal} setSearchTemporal={setTemporal}
                    startDate={start} setStartDate={setStart} endDate={end} setEndDate={setEnd}
                    onChange={() => {}} />
                <Box component="pre" data-testid="Start Date-parts">{JSON.stringify(readDateParts(start), null, 2)}</Box>
                <Box component="pre" data-testid="End Date-parts">{JSON.stringify(readDateParts(end), null, 2)}</Box>
                <Button href="#/">{language === 'fr' ? 'Retour à la recherche' : 'Back to search'}</Button>
            </Stack>
        </Container>
    );
}
