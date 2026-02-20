
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayoutDashboard, Users, CreditCard, Activity, AlertTriangle, Server, Clock } from "lucide-react";

interface AdminStats {
    totalUsers: number;
    activeSubscriptions: number;
    totalRevenue: number;
    systemHealth: string;
    errorCount: number;
    recentErrors: Array<{
        id: number;
        userId: string | null;
        endpoint: string | null;
        errorMessage: string;
        createdAt: string;
    }>;
}

interface AdminUser {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    role: string;
    balance: number | null;
    referralCode: string | null;
    referredBy: string | null;
    createdAt: string;
    subscription: { plan: string; credits: number; creditsUsed: number } | null;
}

export default function AdminPanel() {
    const { data: stats, isLoading } = useQuery<AdminStats>({
        queryKey: ["/api/admin/stats"],
    });

    const { data: usersData } = useQuery<{ users: AdminUser[] }>({
        queryKey: ["/api/admin/users"],
    });

    if (isLoading) {
        return <div className="p-8 text-center">Загрузка данных админ-панели...</div>;
    }

    const safeStats = stats || {
        totalUsers: 0,
        activeSubscriptions: 0,
        totalRevenue: 0,
        systemHealth: "unknown",
        errorCount: 0,
        recentErrors: []
    };

    return (
        <div className="container mx-auto py-12 px-4">
            <div className="flex items-center gap-3 mb-8">
                <LayoutDashboard className="h-8 w-8 text-primary" />
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                    Панель управления
                </h1>
            </div>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
                <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Пользователей</CardTitle>
                        <Users className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{safeStats.totalUsers}</div>
                        <p className="text-xs text-muted-foreground">Всего зарегистрировано</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Подписки</CardTitle>
                        <CreditCard className="h-4 w-4 text-purple-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{safeStats.activeSubscriptions}</div>
                        <p className="text-xs text-muted-foreground">Активных подписок</p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Доход</CardTitle>
                        <span className="text-green-400 font-bold text-lg">$</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-400">${safeStats.totalRevenue}</div>
                        <p className="text-xs text-muted-foreground">MRR</p>
                    </CardContent>
                </Card>

                <Card className={`bg-gradient-to-br ${safeStats.systemHealth === "healthy" ? "from-green-500/10 border-green-500/20" : "from-red-500/10 border-red-500/20"}`}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Система</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-2">
                            <Badge variant={safeStats.systemHealth === "healthy" ? "outline" : "destructive"} className={safeStats.systemHealth === "healthy" ? "text-green-400 border-green-500/30" : ""}>
                                {safeStats.systemHealth === "healthy" ? "✅ Всё работает" : "⚠️ Проблемы"}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Ошибок: {safeStats.errorCount}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Users Table */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-400" />
                        Пользователи
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {usersData?.users && usersData.users.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Тариф</TableHead>
                                    <TableHead>Кредиты</TableHead>
                                    <TableHead>Роль</TableHead>
                                    <TableHead>Реферал</TableHead>
                                    <TableHead>Дата</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {usersData.users.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">{u.email || u.id.substring(0, 8)}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                {u.subscription?.plan || "basic"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {u.subscription
                                                ? `${u.subscription.credits - u.subscription.creditsUsed} / ${u.subscription.credits}`
                                                : `${u.balance || 0}`
                                            }
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                                                {u.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {u.referredBy || "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {new Date(u.createdAt).toLocaleDateString("ru")}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">Пока нет пользователей</div>
                    )}
                </CardContent>
            </Card>

            {/* Recent Errors */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        Последние ошибки
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {safeStats.recentErrors.length > 0 ? (
                        <div className="space-y-3">
                            {safeStats.recentErrors.map((err) => (
                                <div key={err.id} className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex justify-between items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-red-400 font-mono truncate">{err.errorMessage}</p>
                                        {err.endpoint && (
                                            <p className="text-xs text-muted-foreground mt-1">{err.endpoint}</p>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {new Date(err.createdAt).toLocaleString("ru")}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-center">
                            ✅ Ошибок нет — система работает стабильно
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
