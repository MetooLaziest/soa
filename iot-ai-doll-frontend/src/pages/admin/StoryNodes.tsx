/**
 * React Flow 剧情节点编辑器
 * 从后端加载节点和边，支持拖拽编辑
 */
import { useState, useEffect, useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, type Connection, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import client from '../../api/client';

interface NodeData {
  label: string;
  nodeType: string;
  content: string;
  [key: string]: unknown;
}

export default function StoryNodes() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        // 从 URL 获取 mainStoryId 和 subStoryId
        const params = new URLSearchParams(window.location.search);
        const mainId = params.get('main');
        const subId = params.get('sub');
        
        if (!mainId || !subId) {
          alert('缺少 main 或 sub 参数');
          setLoading(false);
          return;
        }

        // 加载节点
        const res = await client.get(`/db/query`, {
          params: { table: 'story_nodes', filter_main_story_id: `eq:${mainId}` }
        });
        const dbNodes: Node<NodeData>[] = (res.data.rows || []).map((n: any) => ({
          id: n.id,
          type: 'custom',
          position: { x: n.position_x || 0, y: n.position_y || 0 },
          data: { label: n.title, nodeType: n.node_type, content: n.content }
        }));

        // 加载边
        const edgesRes = await client.get(`/db/query`, {
          params: { table: 'story_options', filter_main_story_id: `eq:${mainId}` }
        });
        const dbEdges: Edge[] = (edgesRes.data.rows || [])
          .filter((o: any) => o.next_node_id)
          .map((o: any) => ({
            id: `e${o.id}`,
            source: o.node_id,
            target: o.next_node_id,
            label: o.text?.slice(0, 10) || '→'
          }));

        setNodes(dbNodes);
        setEdges(dbEdges);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  }, [setEdges]);

  if (loading) return <div className="p-6 text-gray-400">加载节点中...</div>;

  return (
    <div className="h-[calc(100vh-56px)] animate-fade-in-up">
      <div className="border-b border-white/10 bg-card px-6 py-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">剧情节点编辑器</h2>
        <span className="text-xs text-gray-500">{nodes.length} 个节点 · {edges.length} 条边</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
