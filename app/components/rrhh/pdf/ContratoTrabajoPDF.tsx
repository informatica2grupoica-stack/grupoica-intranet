// components/rrhh/pdf/ContratoTrabajoPDF.tsx
'use client';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Registrar fuentes
Font.register({
  family: 'Helvetica',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/helvetica/v1/Helvetica.ttf', fontWeight: 'normal' },
    { src: 'https://fonts.gstatic.com/s/helvetica/v1/Helvetica-Bold.ttf', fontWeight: 'bold' },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.5,
  },
  header: {
    marginBottom: 20,
    textAlign: 'center',
    borderBottom: '1px solid #ccc',
    paddingBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginBottom: 5,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
    backgroundColor: '#f0f0f0',
    padding: 5,
  },
  clause: {
    marginBottom: 10,
  },
  clauseNumber: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  signature: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
    textAlign: 'center',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#000',
    marginTop: 30,
    marginBottom: 5,
    width: '100%',
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    marginVertical: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 5,
  },
  tableCellLabel: {
    width: '30%',
    fontWeight: 'bold',
  },
  tableCellValue: {
    width: '70%',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
});

interface ContratoTrabajoPDFProps {
  empleado: any;
  contrato: any;
  empresa: {
    nombre: string;
    rut: string;
    direccion: string;
  };
}

export default function ContratoTrabajoPDF({ empleado, contrato, empresa }: ContratoTrabajoPDFProps) {
  const hoy = new Date().toLocaleDateString('es-CL');

  const formatSueldo = (sueldo: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(sueldo);
  };

  const formatFecha = (fecha: string) => {
    if (!fecha) return '___';
    return new Date(fecha).toLocaleDateString('es-CL');
  };

  const getTipoContrato = (tipo: string) => {
    const tipos: Record<string, string> = {
      indefinido: 'plazo indefinido',
      plazo_fijo: 'plazo fijo',
      honorarios: 'a honorarios',
      practica: 'de práctica profesional',
      temporal: 'temporal',
    };
    return tipos[tipo] || tipo;
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CONTRATO DE TRABAJO</Text>
          <Text style={styles.subtitle}>Código: {contrato.numero_contrato}</Text>
          <Text style={styles.subtitle}>Fecha: {hoy}</Text>
        </View>

        {/* Identificación de las partes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I. IDENTIFICACIÓN DE LAS PARTES</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Empleador:</Text>
              <Text style={styles.tableCellValue}>{empresa.nombre}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>RUT Empleador:</Text>
              <Text style={styles.tableCellValue}>{empresa.rut}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Domicilio:</Text>
              <Text style={styles.tableCellValue}>{empresa.direccion}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Trabajador:</Text>
              <Text style={styles.tableCellValue}>{empleado.nombre_completo}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>RUT Trabajador:</Text>
              <Text style={styles.tableCellValue}>{empleado.rut}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Nacionalidad:</Text>
              <Text style={styles.tableCellValue}>{empleado.nacionalidad || 'Chilena'}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableCellLabel}>Domicilio:</Text>
              <Text style={styles.tableCellValue}>{empleado.direccion || '___'}</Text>
            </View>
          </View>
        </View>

        {/* Cláusulas */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>II. CLÁUSULAS</Text>
          
          <View style={styles.clause}>
            <Text>
              <Text style={styles.clauseNumber}>PRIMERA:</Text>
              El empleador contrata los servicios del trabajador para desempeñar el cargo de{' '}
              <Text style={{ fontWeight: 'bold' }}>{contrato.cargo || empleado.cargo || '___'}</Text>, 
              en el área de <Text style={{ fontWeight: 'bold' }}>{contrato.area || empleado.area || '___'}</Text>, 
              cumpliendo las funciones que se le asignen conforme a su especialidad.
            </Text>
          </View>

          <View style={styles.clause}>
            <Text>
              <Text style={styles.clauseNumber}>SEGUNDA:</Text>
              La jornada de trabajo será de <Text style={{ fontWeight: 'bold' }}>{contrato.jornada || empleado.jornada || 'completa'}</Text>, 
              cumpliendo un total de 45 horas semanales distribuidas de lunes a viernes según horario establecido por el empleador.
            </Text>
          </View>

          <View style={styles.clause}>
            <Text>
              <Text style={styles.clauseNumber}>TERCERA:</Text>
              El trabajador percibirá una remuneración mensual de{' '}
              <Text style={{ fontWeight: 'bold' }}>{formatSueldo(contrato.sueldo_base || empleado.sueldo_base || 0)}</Text>, 
              pagadera por mensualidades vencidas dentro de los primeros 5 días de cada mes.
            </Text>
          </View>

          <View style={styles.clause}>
            <Text>
              <Text style={styles.clauseNumber}>CUARTA:</Text>
              El presente contrato es a <Text style={{ fontWeight: 'bold' }}>{getTipoContrato(contrato.tipo_contrato || empleado.tipo_contrato || 'indefinido')}</Text>, 
              rigiéndose por las normas del Código del Trabajo.
            </Text>
          </View>

          <View style={styles.clause}>
            <Text>
              <Text style={styles.clauseNumber}>QUINTA:</Text>
              La fecha de inicio de labores es el{' '}
              <Text style={{ fontWeight: 'bold' }}>{formatFecha(contrato.fecha_inicio || empleado.fecha_ingreso)}</Text>.
              {contrato.fecha_fin && (
                <> La fecha de término será el{' '}
                <Text style={{ fontWeight: 'bold' }}>{formatFecha(contrato.fecha_fin)}</Text>.</>
              )}
            </Text>
          </View>

          <View style={styles.clause}>
            <Text>
              <Text style={styles.clauseNumber}>SEXTA:</Text>
              El trabajador tendrá derecho a 15 días hábiles de vacaciones por año calendario, 
              conforme a lo establecido en el artículo 67 del Código del Trabajo.
            </Text>
          </View>

          <View style={styles.clause}>
            <Text>
              <Text style={styles.clauseNumber}>SÉPTIMA:</Text>
              Las partes se someten a la legislación laboral chilena y a la jurisdicción de los tribunales competentes 
              de la comuna de {empleado.comuna || 'Santiago'}.
            </Text>
          </View>
        </View>

        {/* Firmas */}
        <View style={styles.signature}>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text>Empleador</Text>
            <Text style={{ fontSize: 8 }}>{empresa.nombre}</Text>
          </View>
          <View style={styles.signatureBox}>
            <View style={styles.signatureLine} />
            <Text>Trabajador</Text>
            <Text style={{ fontSize: 8 }}>{empleado.nombre_completo}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Documento generado electrónicamente. Sin validez sin firmas originales.</Text>
          <Text>Página 1 de 1</Text>
        </View>
      </Page>
    </Document>
  );
}