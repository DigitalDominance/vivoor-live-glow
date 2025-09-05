import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, Ban, Shield, StopCircle, Users, Radio, Flag, CheckCircle, Clock, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';

interface User {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string;
  created_at: string;
  banned: boolean;
  stream_count: number;
}

interface Stream {
  id: string;
  title: string;
  user_id: string;
  viewers: number;
  created_at: string;
  stream_type: string;
  is_live: boolean;
  profile_handle: string;
  profile_display_name: string;
  profile_avatar_url: string;
}

interface Report {
  id: string;
  reported_stream_id: string;
  reported_user_id: string;
  reporter_user_id: string;
  report_type: string;
  description: string;
  status: string;
  created_at: string;
  stream_title: string;
  reported_user_handle: string;
  reported_user_display_name: string;
  reporter_user_handle: string;
  reporter_user_display_name: string;
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [sessionExpiry, setSessionExpiry] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('users');
  
  // Pagination states
  const [usersPage, setUsersPage] = useState(0);
  const [streamsPage, setStreamsPage] = useState(0);
  const [reportsPage, setReportsPage] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  const [streamsTotal, setStreamsTotal] = useState(0);
  const [reportsTotal, setReportsTotal] = useState(0);
  const itemsPerPage = 20;

  const authenticateAdmin = async () => {
    if (!password.trim()) {
      toast.error('Please enter admin password');
      return;
    }

    setLoading(true);
    try {
      console.log('Attempting admin authentication with password length:', password.length);
      
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'verify_password',
          password: password
        }
      });

      console.log('Authentication response:', { data, error });

      if (error) {
        console.error('Authentication error:', error);
        throw error;
      }

      if (data?.verified) {
        setIsAuthenticated(true);
        // Set session expiry to 1 hour from now
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 1);
        setSessionExpiry(expiry);
        toast.success('Admin access granted');
        loadUsers(0);
        loadStreams(0);
        loadReports(0);
      } else {
        toast.error('Invalid admin password');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      toast.error('Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (page = 0) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'get_users',
          password: password,
          search: searchQuery || undefined,
          limit: itemsPerPage,
          offset: page * itemsPerPage
        }
      });

      if (error) throw error;
      setUsers(data?.users || []);
      // For now, estimate total based on current page results
      setUsersTotal(data?.users?.length === itemsPerPage ? (page + 2) * itemsPerPage : (page * itemsPerPage) + (data?.users?.length || 0));
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  const loadStreams = async (page = 0) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'get_live_streams',
          password: password,
          limit: itemsPerPage,
          offset: page * itemsPerPage
        }
      });

      if (error) throw error;
      setStreams(data?.streams || []);
      setStreamsTotal(data?.streams?.length === itemsPerPage ? (page + 2) * itemsPerPage : (page * itemsPerPage) + (data?.streams?.length || 0));
    } catch (error) {
      console.error('Error loading streams:', error);
      toast.error('Failed to load streams');
    }
  };

  const loadReports = async (page = 0) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'get_reports',
          password: password,
          statusFilter: statusFilter === 'all' ? undefined : statusFilter,
          limit: itemsPerPage,
          offset: page * itemsPerPage
        }
      });

      if (error) throw error;
      setReports(data?.reports || []);
      setReportsTotal(data?.reports?.length === itemsPerPage ? (page + 2) * itemsPerPage : (page * itemsPerPage) + (data?.reports?.length || 0));
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load reports');
    }
  };

  const resolveReport = async (reportId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'resolve_report',
          password: password,
          reportId
        }
      });

      if (error) throw error;

      toast.success(data?.message || 'Report resolved');
      loadReports(reportsPage);
    } catch (error) {
      console.error('Error resolving report:', error);
      toast.error('Failed to resolve report');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserBan = async (userId: string, currentBanStatus: boolean) => {
    setLoading(true);
    try {
      const action = currentBanStatus ? 'unban_user' : 'ban_user';
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action,
          password: password,
          userId
        }
      });

      if (error) throw error;

      toast.success(data?.message || 'User status updated');
      loadUsers(usersPage);
    } catch (error) {
      console.error('Error updating user ban status:', error);
      toast.error('Failed to update user status');
    } finally {
      setLoading(false);
    }
  };

  const endStream = async (streamId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-actions', {
        body: {
          action: 'end_stream',
          password: password,
          streamId
        }
      });

      if (error) throw error;

      toast.success(data?.message || 'Stream ended');
      loadStreams(streamsPage);
    } catch (error) {
      console.error('Error ending stream:', error);
      toast.error('Failed to end stream');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && searchQuery !== '') {
      const timeoutId = setTimeout(() => {
        setUsersPage(0);
        loadUsers(0);
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      setReportsPage(0);
      loadReports(0);
    }
  }, [statusFilter, isAuthenticated]);

  // Session expiry check
  useEffect(() => {
    if (isAuthenticated && sessionExpiry) {
      const checkExpiry = () => {
        if (new Date() > sessionExpiry) {
          setIsAuthenticated(false);
          setPassword('');
          setSessionExpiry(null);
          toast.error('Admin session expired. Please log in again.');
        }
      };

      const interval = setInterval(checkExpiry, 60000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, sessionExpiry]);

  // Password protection screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center gap-2 justify-center">
              <Shield className="h-6 w-6 text-destructive" />
              Admin Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && authenticateAdmin()}
                autoComplete="current-password"
                maxLength={128}
              />
            </div>
            <Button 
              onClick={authenticateAdmin} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Authenticating...' : 'Access Admin Panel'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Admin panel
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-8 w-8 text-destructive" />
          <h1 className="text-3xl font-bold">Admin Panel</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="streams" className="flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Live Streams
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <Flag className="h-4 w-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by handle, name, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => loadUsers(usersPage)} variant="outline">
                Refresh
              </Button>
            </div>

            <div className="grid gap-4">
              {users.map((user) => (
                <Card key={user.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar_url} />
                        <AvatarFallback>
                          {user.display_name?.charAt(0) || user.handle?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.display_name || 'No Name'}</p>
                          {user.banned && (
                            <Badge variant="destructive" className="text-xs">BANNED</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">@{user.handle || 'no-handle'}</p>
                        <p className="text-xs text-muted-foreground">
                          ID: {user.id} • {user.stream_count} streams • Joined: {new Date(user.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={user.banned ? "default" : "destructive"}
                        size="sm"
                        onClick={() => toggleUserBan(user.id, user.banned)}
                        disabled={loading}
                        className="flex items-center gap-1"
                      >
                        <Ban className="h-4 w-4" />
                        {user.banned ? 'Unban' : 'Ban'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {users.length === 0 && (
                <Card>
                  <CardContent className="text-center p-8">
                    <p className="text-muted-foreground">No users found</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Users Pagination */}
            {users.length > 0 && (
              <div className="flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (usersPage > 0) {
                            setUsersPage(usersPage - 1);
                            loadUsers(usersPage - 1);
                          }
                        }}
                        className={usersPage === 0 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, Math.ceil(usersTotal / itemsPerPage)) }, (_, i) => {
                      const pageNum = usersPage > 2 ? usersPage - 2 + i : i;
                      if (pageNum >= Math.ceil(usersTotal / itemsPerPage)) return null;
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink 
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setUsersPage(pageNum);
                              loadUsers(pageNum);
                            }}
                            isActive={pageNum === usersPage}
                          >
                            {pageNum + 1}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if ((usersPage + 1) * itemsPerPage < usersTotal) {
                            setUsersPage(usersPage + 1);
                            loadUsers(usersPage + 1);
                          }
                        }}
                        className={((usersPage + 1) * itemsPerPage >= usersTotal) ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </TabsContent>

          <TabsContent value="streams" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Active Live Streams</h2>
              <Button onClick={() => loadStreams(streamsPage)} variant="outline">
                Refresh
              </Button>
            </div>

            <div className="grid gap-4">
              {streams.map((stream) => (
                <Card key={stream.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={stream.profile_avatar_url} />
                        <AvatarFallback>
                          {stream.profile_display_name?.charAt(0) || stream.profile_handle?.charAt(0) || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{stream.title}</p>
                        <p className="text-sm text-muted-foreground">
                          by @{stream.profile_handle || stream.profile_display_name} • {stream.viewers} viewers
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {stream.stream_type === 'browser' ? 'Browser' : 'RTMP'}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            Started: {new Date(stream.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => endStream(stream.id)}
                        disabled={loading}
                        className="flex items-center gap-1"
                      >
                        <StopCircle className="h-4 w-4" />
                        End Stream
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {streams.length === 0 && (
                <Card>
                  <CardContent className="text-center p-8">
                    <p className="text-muted-foreground">No active streams</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Streams Pagination */}
            {streams.length > 0 && (
              <div className="flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (streamsPage > 0) {
                            setStreamsPage(streamsPage - 1);
                            loadStreams(streamsPage - 1);
                          }
                        }}
                        className={streamsPage === 0 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, Math.ceil(streamsTotal / itemsPerPage)) }, (_, i) => {
                      const pageNum = streamsPage > 2 ? streamsPage - 2 + i : i;
                      if (pageNum >= Math.ceil(streamsTotal / itemsPerPage)) return null;
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink 
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setStreamsPage(pageNum);
                              loadStreams(pageNum);
                            }}
                            isActive={pageNum === streamsPage}
                          >
                            {pageNum + 1}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if ((streamsPage + 1) * itemsPerPage < streamsTotal) {
                            setStreamsPage(streamsPage + 1);
                            loadStreams(streamsPage + 1);
                          }
                        }}
                        className={((streamsPage + 1) * itemsPerPage >= streamsTotal) ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold flex-1">Reports Management</h2>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reports</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => loadReports(reportsPage)} variant="outline">
                Refresh
              </Button>
            </div>

            <div className="grid gap-4">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={report.status === 'pending' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {report.status === 'pending' ? (
                              <>
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Resolved
                              </>
                            )}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {report.report_type.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(report.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <p className="text-sm font-medium">
                              Stream: {report.stream_title || 'Unknown Stream'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Reported User: @{report.reported_user_handle || report.reported_user_display_name || 'Unknown'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Reporter: @{report.reporter_user_handle || report.reporter_user_display_name || 'Unknown'}
                            </p>
                          </div>
                          
                          {report.description && (
                            <div className="bg-muted/50 p-3 rounded-lg">
                              <p className="text-sm text-muted-foreground">
                                <strong>Details:</strong> {report.description}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        {report.status === 'pending' && (
                          <>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => endStream(report.reported_stream_id)}
                              disabled={loading}
                            >
                              <StopCircle className="h-4 w-4 mr-1" />
                              End Stream
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => toggleUserBan(report.reported_user_id, false)}
                              disabled={loading}
                            >
                              <Ban className="h-4 w-4 mr-1" />
                              Ban User
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => resolveReport(report.id)}
                              disabled={loading}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Resolve
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {reports.length === 0 && (
                <Card>
                  <CardContent className="text-center p-8">
                    <p className="text-muted-foreground">No reports found</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Reports Pagination */}
            {reports.length > 0 && (
              <div className="flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (reportsPage > 0) {
                            setReportsPage(reportsPage - 1);
                            loadReports(reportsPage - 1);
                          }
                        }}
                        className={reportsPage === 0 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, Math.ceil(reportsTotal / itemsPerPage)) }, (_, i) => {
                      const pageNum = reportsPage > 2 ? reportsPage - 2 + i : i;
                      if (pageNum >= Math.ceil(reportsTotal / itemsPerPage)) return null;
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink 
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setReportsPage(pageNum);
                              loadReports(pageNum);
                            }}
                            isActive={pageNum === reportsPage}
                          >
                            {pageNum + 1}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if ((reportsPage + 1) * itemsPerPage < reportsTotal) {
                            setReportsPage(reportsPage + 1);
                            loadReports(reportsPage + 1);
                          }
                        }}
                        className={((reportsPage + 1) * itemsPerPage >= reportsTotal) ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}