'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
    LineChart,
    Line,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const COLORS = {
    primary: '#0066cc',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    purple: '#8b5cf6',
    pink: '#ec4899',
    teal: '#14b8a6',
};

const CHART_COLORS = [
    COLORS.primary,
    COLORS.success,
    COLORS.warning,
    COLORS.danger,
    COLORS.info,
    COLORS.purple,
    COLORS.pink,
    COLORS.teal,
];

interface ChartData {
    name: string;
    value: number;
    color?: string;
}

interface BarChartData {
    name: string;
    value: number;
    [key: string]: string | number;
}

interface RevisionesPorMesChartProps {
    data: BarChartData[];
    title?: string;
}

export function RevisionesPorMesChart({ 
    data, 
    title = 'Revisiones por Mes' 
}: RevisionesPorMesChartProps) {
    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                                dataKey="name" 
                                tick={{ fontSize: 11 }} 
                                stroke="#9ca3af"
                                tickLine={false}
                            />
                            <YAxis 
                                tick={{ fontSize: 11 }} 
                                stroke="#9ca3af"
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                }}
                            />
                            <Bar 
                                dataKey="value" 
                                fill={COLORS.primary} 
                                radius={[4, 4, 0, 0]}
                                name="Revisiones"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

interface ActivosPorEstadoChartProps {
    data: ChartData[];
    title?: string;
}

export function ActivosPorEstadoChart({ 
    data, 
    title = 'Activos por Estado' 
}: ActivosPorEstadoChartProps) {
    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={2}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} 
                                    />
                                ))}
                            </Pie>
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                }}
                            />
                            <Legend 
                                layout="horizontal" 
                                verticalAlign="bottom" 
                                align="center"
                                wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

interface TendenciaChartProps {
    data: BarChartData[];
    title?: string;
}

export function TendenciaChart({ 
    data, 
    title = 'Tendencia de Revisiones' 
}: TendenciaChartProps) {
    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                                dataKey="name" 
                                tick={{ fontSize: 11 }} 
                                stroke="#9ca3af"
                                tickLine={false}
                            />
                            <YAxis 
                                tick={{ fontSize: 11 }} 
                                stroke="#9ca3af"
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                }}
                            />
                            <Line 
                                type="monotone" 
                                dataKey="value" 
                                stroke={COLORS.primary} 
                                strokeWidth={2}
                                dot={{ fill: COLORS.primary, strokeWidth: 2, r: 4 }}
                                activeDot={{ r: 6 }}
                                name="Revisiones"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

interface CategoriaChartProps {
    data: BarChartData[];
    title?: string;
}

export function CategoriaChart({ 
    data, 
    title = 'Por Categoría' 
}: CategoriaChartProps) {
    return (
        <Card className="h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                            data={data} 
                            layout="vertical"
                            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
                            <XAxis 
                                type="number" 
                                tick={{ fontSize: 11 }} 
                                stroke="#9ca3af"
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis 
                                type="category" 
                                dataKey="name" 
                                tick={{ fontSize: 11 }} 
                                stroke="#9ca3af"
                                tickLine={false}
                                width={80}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                }}
                            />
                            <Bar 
                                dataKey="value" 
                                fill={COLORS.info} 
                                radius={[0, 4, 4, 0]}
                                name="Cantidad"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}

export { CHART_COLORS, COLORS };
