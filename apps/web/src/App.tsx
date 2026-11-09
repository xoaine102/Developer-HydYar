import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ToastHost from "./components/ToastHost";
import DocOverlayHost from "./components/DocOverlayHost";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import Database from "./pages/Database";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Support from "./pages/Support";
import DocsIndex from "./pages/DocsIndex";
import DocsLearn from "./pages/DocsLearn";
import DocsReference from "./pages/DocsReference";
import Contribute from "./pages/Contribute";
import IDE from "./pages/IDE";
import SqlEnv from "./pages/SqlEnv";
import LuaStudio from "./pages/LuaStudio";
import Forum from "./pages/Forum";
import ForumPost from "./pages/ForumPost";
import Chat from "./pages/Chat";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/database" element={<Database />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/account/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/account/support" element={<Support />} />
        <Route path="/docs/:lang" element={<DocsIndex />} />
        <Route path="/docs/:lang/learn/:slug" element={<DocsLearn />} />
        <Route path="/docs/:lang/reference" element={<DocsReference />} />
        <Route path="/contribute" element={<Contribute />} />
        <Route path="/ide" element={<IDE />} />
        <Route path="/ide/:projectId" element={<IDE />} />
        <Route path="/sql" element={<SqlEnv />} />
        <Route path="/lua-studio" element={<LuaStudio />} />
        <Route path="/community/forum" element={<Forum />} />
        <Route path="/community/forum/:id" element={<ForumPost />} />
        <Route path="/community/chat" element={<Chat />} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <DocOverlayHost />
      <ToastHost />
    </Layout>
  );
}
